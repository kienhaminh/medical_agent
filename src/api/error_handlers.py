import logging
from fastapi import HTTPException

def raise_not_found(resource: str, identifier=None) -> None:
    detail = f"{resource} not found" if identifier is None else f"{resource} {identifier} not found"
    raise HTTPException(status_code=404, detail=detail)

def raise_bad_request(message: str) -> None:
    raise HTTPException(status_code=400, detail=message)

def raise_internal_error(logger: logging.Logger, message: str, exc: Exception) -> None:
    logger.error(message, exc_info=True)
    raise HTTPException(status_code=500, detail=str(exc))
