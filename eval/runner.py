# eval/runner.py
"""
Medera Agent Evaluation Runner

Usage:
  python eval/runner.py                          # run all cases
  python eval/runner.py --case cardiology-chest-pain-001
  python eval/runner.py --judge                  # enable LLM-as-judge scoring

Prerequisites:
  - API server running at EVAL_BASE_URL (default: http://localhost:8000)
  - DATABASE_URL set to the PostgreSQL connection string
"""
import asyncio
import argparse
import json
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from eval.api_client import EvalApiClient
from eval.case_loader import EvalCase, load_all_cases, load_case
from eval.doctor_simulator import DoctorResult, DoctorSimulator
from eval.intake_simulator import IntakeSimulator, TriageResult
from eval.patient_seeder import PatientSeeder
from eval.report import generate_report
from eval.scorer import CaseScore, score_case

CASES_DIR = Path(__file__).parent / "cases"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/medera",
)


async def run_case(
    case: EvalCase,
    client: EvalApiClient,
    engine,
    use_judge: bool = False,
    verbose: bool = False,
) -> CaseScore:
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        seeder = PatientSeeder(db=db, api_client=client)
        patient_id = await seeder.seed(case)

        try:
            intake_result = await IntakeSimulator(client=client).run(case, patient_id, verbose=verbose)
            if verbose:
                _print_intake(intake_result)
            doctor_result = await DoctorSimulator(client=client).run(
                patient_id=patient_id,
                visit_id=intake_result.visit_id,
                verbose=verbose,
            )
            if verbose:
                _print_doctor(doctor_result)
            score = score_case(case, intake_result, doctor_result)
            if use_judge:
                from eval.judge import judge_ddx, judge_history, judge_soap
                patient_summary = case.description
                score.ddx.details["judge"] = await judge_ddx(patient_summary, doctor_result.ddx_output)
                score.history.details["judge"] = await judge_history(patient_summary, doctor_result.history_output)
                score.soap.details["judge"] = await judge_soap(patient_summary, doctor_result.soap_output)
            return score
        finally:
            await seeder.teardown(patient_id)


def _print_intake(result: TriageResult) -> None:
    print("\n--- INTAKE ---")
    print(f"  department : {result.department}")
    print(f"  confidence : {result.confidence}")
    print(f"  visit_id   : {result.visit_id}")
    print(f"  tool_calls : {json.dumps(result.tool_calls, indent=4)}")
    for i, resp in enumerate(result.agent_responses):
        print(f"  [turn {i+1}] {resp[:300]}")


def _print_doctor(result: DoctorResult) -> None:
    print("\n--- DOCTOR ---")
    print(f"  DDx:\n{result.ddx_output[:500]}\n")
    print(f"  History:\n{result.history_output[:500]}\n")
    print(f"  SOAP:\n{result.soap_output[:500]}\n")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Medera Agent Evaluation Runner")
    parser.add_argument("--case", help="Run a specific case by ID (without .yaml extension)")
    parser.add_argument("--judge", action="store_true", help="Enable LLM-as-judge scoring (requires ANTHROPIC_API_KEY)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print agent outputs and tool calls for debugging")
    args = parser.parse_args()

    base_url = os.getenv("EVAL_BASE_URL", "http://localhost:8000")
    engine = create_async_engine(DATABASE_URL)

    if args.case:
        cases = [load_case(CASES_DIR / f"{args.case}.yaml")]
    else:
        cases = load_all_cases(CASES_DIR)

    print(f"Running {len(cases)} case(s) against {base_url}")

    # Limit concurrency to avoid overwhelming the API server
    sem = asyncio.Semaphore(5)

    async def run_and_print(case: EvalCase, client: EvalApiClient) -> CaseScore | None:
        async with sem:
            try:
                score = await run_case(case, client, engine, use_judge=args.judge, verbose=args.verbose)
                status = "PASS" if score.all_passed else "FAIL"
                print(
                    f"  [{case.id}] {status} "
                    f"(triage={score.triage.passed} "
                    f"ddx={score.ddx.passed} "
                    f"history={score.history.passed} "
                    f"soap={score.soap.passed})",
                    flush=True,
                )
                return score
            except Exception as exc:
                print(f"  [{case.id}] ERROR: {type(exc).__name__}: {exc}", flush=True)
                return None

    async with EvalApiClient(base_url) as client:
        results = await asyncio.gather(*[run_and_print(case, client) for case in cases])

    scores: list[CaseScore] = [r for r in results if r is not None]

    try:
        if scores:
            json_path = generate_report(scores)
            print(f"\nReport: {json_path}")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
