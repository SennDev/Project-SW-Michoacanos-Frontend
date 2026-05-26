interface GuideStep {
    title: string;
    description: string;
}

class GuideComponent {
    private currentIdx: number = 0;
    private localSteps: GuideStep[] = [
        {
            title: "Estructura Base",
            description: "El diseño web se despliega de forma modular, manteniendo un tipado seguro en sus interacciones visuales."
        },
        {
            title: "Interacción de Vistas",
            description: "Permite simular eventos del DOM, capturar clics del cliente y mutar los textos dinámicamente en tiempo de ejecución."
        },
        {
            title: "Verificación de Flujos",
            description: "Analiza el comportamiento lógico de los componentes de la interfaz de manera independiente y controlada."
        }
    ];

    private badge: HTMLElement | null;
    private title: HTMLElement | null;
    private desc: HTMLElement | null;
    private nextBtn: HTMLButtonElement | null;
    private prevBtn: HTMLButtonElement | null;

    constructor() {
        this.badge = document.getElementById('step-badge');
        this.title = document.getElementById('step-title');
        this.desc = document.getElementById('step-desc');
        this.nextBtn = document.getElementById('btn-next') as HTMLButtonElement;
        this.prevBtn = document.getElementById('btn-prev') as HTMLButtonElement;

        this.initEvents();
        this.render();
    }

    private initEvents(): void {
        this.nextBtn?.addEventListener('click', () => this.move(1));
        this.prevBtn?.addEventListener('click', () => this.move(-1));
    }

    private move(direction: number): void {
        const nextIdx = this.currentIdx + direction;
        if (nextIdx >= 0 && nextIdx < this.localSteps.length) {
            this.currentIdx = nextIdx;
            this.render();
        }
    }

    private render(): void {
        const currentData = this.localSteps[this.currentIdx];
        
        if (this.badge) this.badge.textContent = `Paso ${this.currentIdx + 1} de ${this.localSteps.length}`;
        if (this.title) this.title.textContent = currentData.title;
        if (this.desc) this.desc.textContent = currentData.description;

        if (this.prevBtn) this.prevBtn.disabled = this.currentIdx === 0;
        if (this.nextBtn) {
            this.nextBtn.textContent = this.currentIdx === this.localSteps.length - 1 ? "Finalizar" : "Siguiente paso";
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new GuideComponent());