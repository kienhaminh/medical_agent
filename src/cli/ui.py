"""CLI UI utilities."""

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()


def print_user_message(message: str) -> None:
    """Print user message.

    Args:
        message: User message to print
    """
    console.print(f"[bold cyan]You:[/bold cyan] {message}")


def print_assistant_message(message: str) -> None:
    """Print assistant message with markdown rendering.

    Args:
        message: Assistant message to print
    """
    console.print("[bold green]Assistant:[/bold green]")
    console.print(Markdown(message))
    console.print()


def print_error(message: str) -> None:
    """Print error message.

    Args:
        message: Error message to print
    """
    console.print(f"[bold red]Error:[/bold red] {message}")


def print_info(message: str) -> None:
    """Print info message.

    Args:
        message: Info message to print
    """
    console.print(f"[blue]ℹ[/blue] {message}")


def print_success(message: str) -> None:
    """Print success message.

    Args:
        message: Success message to print
    """
    console.print(f"[green]✓[/green] {message}")


def print_warning(message: str) -> None:
    """Print warning message.

    Args:
        message: Warning message to print
    """
    console.print(f"[yellow]⚠[/yellow] {message}")


def print_panel(content: str, title: str = "", style: str = "blue") -> None:
    """Print content in a panel.

    Args:
        content: Content to print
        title: Panel title
        style: Panel style
    """
    console.print(Panel(content, title=title, style=style))


def create_spinner(text: str = "Processing..."):
    """Create a spinner for long operations.

    Args:
        text: Spinner text

    Returns:
        Progress context manager
    """
    return Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    )


def stream_response(chunks) -> str:
    """Stream and display response chunks.

    Args:
        chunks: Iterator of text chunks

    Returns:
        Complete response text
    """
    console.print("[bold green]Assistant:[/bold green]", end=" ")

    complete_text = ""
    for chunk in chunks:
        console.print(chunk, end="")
        complete_text += chunk

    console.print("\n")
    return complete_text
