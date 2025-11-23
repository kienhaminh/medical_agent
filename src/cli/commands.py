"""CLI commands for AI Agent."""

import sys
import asyncio
from pathlib import Path

import typer
from rich.prompt import Prompt

from ..agent.langgraph_agent import LangGraphAgent
from ..config.settings import load_config
from ..llm.gemini import GeminiProvider
from ..llm.openai import OpenAIProvider
from ..llm.kimi import KimiProvider
from ..utils.errors import AIAgentError, ConfigurationError
from .ui import (
    console,
    print_assistant_message,
    print_error,
    print_info,
    print_success,
    print_user_message,
    stream_response,
)

app = typer.Typer(
    name="ai-agent",
    help="A personal AI agent with CLI interface",
    add_completion=False,
)


def create_agent(verbose: bool = False) -> Agent:
    """Create and initialize agent.

    Args:
        verbose: Enable verbose logging

    Returns:
        Initialized Agent instance

    Raises:
        ConfigurationError: If configuration is invalid
    """
    try:
        # Load configuration
        config = load_config()

        # Create LLM provider
        llm_provider = KimiProvider(
            api_key=config.kimi_api_key,
            model="kimi-k2-thinking",
            temperature=0.3,
        )

        # Create agent
        system_prompt = (
            "You are a helpful AI assistant. Provide clear, concise, and accurate responses."
        )
        agent = LangGraphAgent(
            llm_with_tools=llm_provider.llm,
            system_prompt=system_prompt,
            # memory_manager=None, # CLI doesn't use persistent memory for now
        )

        if verbose:
            print_success(f"Agent initialized with model: {config.model}")

        return agent

    except ConfigurationError as e:
        print_error(f"Configuration error: {str(e)}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Failed to initialize agent: {str(e)}")
        raise typer.Exit(1)


@app.command()
def chat(
    message: str = typer.Argument(..., help="Message to send to the agent"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose output"),
    stream: bool = typer.Option(False, "--stream", "-s", help="Stream the response"),
):
    """Send a single message to the agent."""
    try:
        # Create agent
        agent = create_agent(verbose=verbose)

        # Print user message
        if verbose:
            print_user_message(message)

        async def run():
            # Process message
            if stream:
                response_chunks = await agent.process_message(message, stream=True)
                stream_response(response_chunks)
            else:
                response = await agent.process_message(message)
                print_assistant_message(response)

        asyncio.run(run())

    except AIAgentError as e:
        print_error(f"Agent error: {str(e)}")
        raise typer.Exit(1)
    except KeyboardInterrupt:
        print_info("\nInterrupted by user")
        raise typer.Exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        if verbose:
            console.print_exception()
        raise typer.Exit(1)


@app.command()
def interactive(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose output"),
    stream: bool = typer.Option(True, "--stream/--no-stream", help="Stream responses (default: True)"),
):
    """Start an interactive chat session (REPL mode)."""
    try:
        # Create agent
        agent = create_agent(verbose=verbose)

        print_success("Interactive mode started. Type 'exit', 'quit', or 'q' to exit.")
        # print_info("Type 'clear' to clear conversation context.\n") # Not supported in LangGraphAgent yet

        async def run_loop():
            while True:
                # Get user input
                try:
                    user_input = Prompt.ask("[bold cyan]You[/bold cyan]")
                except (EOFError, KeyboardInterrupt):
                    print_info("\nExiting interactive mode...")
                    break

                # Handle special commands
                if user_input.lower() in ["exit", "quit", "q"]:
                    print_info("Exiting interactive mode...")
                    break

                # if user_input.lower() == "clear":
                #     agent.clear_context()
                #     print_success("Context cleared.")
                #     continue

                if not user_input.strip():
                    continue

                # Process message
                try:
                    if stream:
                        response_chunks = await agent.process_message(user_input, stream=True)
                        stream_response(response_chunks)
                    else:
                        response = await agent.process_message(user_input)
                        print_assistant_message(response)

                except AIAgentError as e:
                    print_error(f"Agent error: {str(e)}")
                    continue

        asyncio.run(run_loop())

        print_success("Goodbye!")

    except ConfigurationError as e:
        print_error(f"Configuration error: {str(e)}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        if verbose:
            console.print_exception()
        raise typer.Exit(1)


@app.command()
def version():
    """Show version information."""
    print_info("AI Agent v0.1.0")
    print_info("Powered by Google Gemini")


if __name__ == "__main__":
    app()
