class LoadingComponent {
    private titleElement: HTMLElement | null;
    private statusElement: HTMLElement | null;
    private mockStates: string[] = [
        "Simulando detección de entorno local...",
        "Comprobando existencia de módulos aislados...",
        "Renderizando estructura estática de la interfaz...",
        "¡Estructura cargada con éxito!"
    ];

    constructor() {
        this.titleElement = document.getElementById('loading-title');
        this.statusElement = document.getElementById('loading-status');
        this.startLifecycleSimulation();
    }

    private startLifecycleSimulation(): void {
        let step = 0;
        const interval = setInterval(() => {
            if (this.statusElement && step < this.mockStates.length) {
                this.statusElement.textContent = this.mockStates[step];
                step++;
            } else {
                clearInterval(interval);
                this.completeLifecycle();
            }
        }, 1300);
    }

    private completeLifecycle(): void {
        if (this.titleElement) {
            this.titleElement.textContent = "Componente Listo";
            this.titleElement.style.color = "#4ade80";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new LoadingComponent());