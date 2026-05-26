class IntegrationComponent {
    private triggerButton: HTMLButtonElement | null;
    private outputElement: HTMLElement | null;

    constructor() {
        this.triggerButton = document.getElementById('btn-trigger') as HTMLButtonElement;
        this.outputElement = document.getElementById('api-output');
        this.bindEvents();
    }

    private bindEvents(): void {
        this.triggerButton?.addEventListener('click', () => this.mockRequestEvent());
    }

    private mockRequestEvent(): void {
        if (this.outputElement) {
            this.outputElement.textContent = "Procesando evento interno de la vista...";
            this.outputElement.style.color = "#38bdf8";
        }

        setTimeout(() => {
            if (this.outputElement) {
                this.outputElement.textContent = "Flujo simulado: El frontend procesó la acción correctamente.";
                this.outputElement.style.color = "#4ade80";
            }
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => new IntegrationComponent());