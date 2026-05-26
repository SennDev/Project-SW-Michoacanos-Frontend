const cards = Array.from(document.querySelectorAll<HTMLElement>('.card'));
const detail = document.getElementById('detail')!;
const detailTitle = document.getElementById('detailTitle')!;
const detailDesc = document.getElementById('detailDesc')!;
const detailExample = document.getElementById('detailExample')!;
const closeBtn = document.getElementById('closeDetail')!;

const examples: Record<string, {title:string,desc:string,example:string}> = {
  "200": {
    title: "200 — OK",
    desc: "Respuesta correcta. Recomendación: cachear cuando aplique y devolver payload mínimo.",
    example: `HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok","data":{}}`
  },
  "300": {
    title: "300 — Redirección",
    desc: "Usar 301 para redirección permanente, 302 para temporal. Verificar cabeceras Location.",
    example: `HTTP/1.1 301 Moved Permanently
Location: https://example.com/new-path`
  },
  "400": {
    title: "400 — Error del cliente",
    desc: "Validar entrada en el cliente y servidor. Devolver mensajes claros y códigos específicos (401,403,404).",
    example: `HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error":"invalid_payload","message":"campo 'email' requerido"}`
  },
  "500": {
    title: "500 — Error del servidor",
    desc: "Revisar logs, activar alertas y circuit breakers. No exponer stack traces en producción.",
    example: `HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{"error":"server_error","id":"abc123" }`
  }
};

