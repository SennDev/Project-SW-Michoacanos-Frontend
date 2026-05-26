class IntegrationComponent {
    private triggerButton: HTMLButtonElement | null;
    private retryButton: HTMLButtonElement | null;
    private statusCard: HTMLElement | null;
    private outputElement: HTMLElement | null;

    constructor() {
        this.triggerButton = document.getElementById('btn-trigger') as HTMLButtonElement;
        this.retryButton = document.getElementById('btn-retry') as HTMLButtonElement;
        this.statusCard = document.getElementById('status-card');
        this.outputElement = document.getElementById('api-output');
        this.bindEvents();
    }

    private bindEvents(): void {
        this.triggerButton?.addEventListener('click', () => this.executeMockRequest());
        this.retryButton?.addEventListener('click', () => this.executeMockRequest());
    }

    private executeMockRequest(): void {
        this.setVisualState("loading", "Enviando payload al servidor de manera asíncrona...");
        if (this.triggerButton) this.triggerButton.disabled = true;

        setTimeout(() => {
            // Simulación probabilística: 40% de probabilidad de lanzar un error de red/servidor
            const isSuccess = Math.random() > 0.4;

            if (isSuccess) {
                this.setVisualState("success", "Response [200 OK]: Conexión e intercambio de datos completado.");
            } else {
                this.setVisualState("error", "Error [500 Internal Server Error]: El backend no pudo procesar la solicitud.");
            }
            
            if (this.triggerButton) this.triggerButton.disabled = false;
        }, 1200);
    }

    private setVisualState(state: "loading" | "success" | "error", message: string): void {
        if (!this.statusCard || !this.outputElement || !this.retryButton) return;

        // Limpiar estados previos
        this.statusCard.classList.remove('hidden', 'state-loading', 'state-success', 'state-error');
        this.retryButton.classList.add('hidden');

        // Asignar nuevos comportamientos según el estado de la máquina
        this.outputElement.textContent = message;
        this.statusCard.classList.add(`state-${state}`);

        if (state === "loading") {
            this.outputElement.style.color = "#38bdf8";
        } else if (state === "success") {
            this.outputElement.style.color = "#4ade80";
        } else if (state === "error") {
            this.outputElement.style.color = "#f87171";
            this.retryButton.classList.remove('hidden'); // Mostrar opción de recuperación
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new IntegrationComponent());