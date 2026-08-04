// `48` `RUL-AYUDA-08`/`SCR-AYUDA-03`/`SCR-AYUDA-04` — nueve artículos, no
// noventa. Cada uno responde la pregunta que de verdad se hace; si una
// función necesitara tres artículos, la función estaría mal diseñada.
export type HelpArticle = {
  slug: string;
  question: string;
  body: string[];
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "dinero-libre",
    question: "Qué es el dinero libre",
    body: [
      "Es lo que tienes de verdad para gastar hoy: lo que hay en tus cuentas, menos lo que ya está apartado en cajas y menos los compromisos que vienen y todavía no tienen caja que los cubra.",
      "No es tu saldo. Tu saldo es lo que el banco dice que tienes; el dinero libre es lo que te queda después de restar lo que ya está comprometido.",
      "Cada vez que ves la cifra, puedes pulsarla para ver exactamente de qué cuentas y compromisos sale.",
    ],
  },
  {
    slug: "cajas-compromisos-presupuestos",
    question: "Cajas, compromisos y presupuestos: en qué se diferencian",
    body: [
      "Una caja es dinero que ya apartaste, dentro de una cuenta, para algo concreto: el alquiler, un viaje, un fondo de emergencia.",
      "Un compromiso es un pago que sabes que viene — una cuota, un servicio — y que puedes vincular a una caja para que se vea cubierto.",
      "Un presupuesto es un límite que te pones para una categoría de gasto en un periodo. No aparta dinero: solo te avisa cuando te acercas o te pasas.",
      "Los tres trabajan juntos: una caja cubre un compromiso, y un presupuesto vigila cuánto gastas mientras tanto.",
    ],
  },
  {
    slug: "conectar-correo",
    question: "Cómo conecto mi correo y qué leo de él",
    body: [
      "Conectas tu cuenta de Gmail y eliges qué bancos autorizas. Solo leo los correos de los remitentes que tú apruebas.",
      "No guardo el contenido completo de esos correos, solo lo necesario para proponerte un movimiento.",
      "Todo lo que detecto queda como pendiente hasta que tú lo confirmas: nunca registro nada solo.",
      "Puedes desconectar tu correo en cualquier momento desde Configuración → Tu correo.",
    ],
  },
  {
    slug: "nada-se-registra-solo",
    question: "Por qué nada se registra solo",
    body: [
      "Porque es tu dinero, y una cifra equivocada sin que te dieras cuenta es peor que no tener la cifra.",
      "Todo lo que detecto — por correo, por el asistente, por cualquier vía — llega como pendiente. Tú lo confirmas, lo corriges o lo descartas.",
      "Esa confirmación es la que hace que, con el tiempo, confíes en lo que ves sin tener que revisarlo todo.",
    ],
  },
  {
    slug: "corregir-clasificacion",
    question: "Cómo corrijo algo mal clasificado",
    body: [
      "Abre el movimiento y cambia su categoría. El cambio se aplica de inmediato y puedes deshacerlo si te equivocaste.",
      "Si Manzana clasificó igual varias veces del mismo comercio, puedes decirle que lo recuerde para la próxima vez.",
      "Corregir no es un reproche al sistema: es cómo aprende qué es correcto para ti.",
    ],
  },
  {
    slug: "que-recuerda-y-como-se-borra",
    question: "Qué recuerdo de ti y cómo lo borras",
    body: [
      "Recuerdo patrones que confirmas o corriges — por ejemplo, que cierto comercio siempre es de una categoría — nunca el contenido de tus conversaciones o correos.",
      "Puedes ver todo lo aprendido en Configuración → Lo que sé de ti, y olvidar cualquier cosa con un botón.",
      "Olvidar es inmediato: deja de aplicarse la próxima vez que ocurra algo parecido.",
    ],
  },
  {
    slug: "llevarme-mis-datos",
    question: "Cómo me llevo mis datos",
    body: [
      "Desde Configuración → Tus datos puedes descargar tus movimientos en CSV, o pedir una exportación completa con todo lo que Manzana sabe de ti.",
      "La exportación completa incluye tus cuentas, cajas, deudas, presupuestos, lo aprendido y tus conversaciones.",
      "El enlace de descarga es tuyo, privado, y caduca a las 24 horas por seguridad.",
    ],
  },
  {
    slug: "eliminar-mi-cuenta",
    question: "Cómo elimino mi cuenta",
    body: [
      "Desde Configuración → Tus datos → Eliminar mi cuenta. Puedes descargar tus datos antes si quieres conservarlos.",
      "Se te muestran cifras reales de lo que vas a perder, y escribes una frase de confirmación exacta.",
      "El borrado es inmediato y no se puede deshacer: no hay periodo de gracia. Si tenías un correo conectado, también revocamos el permiso con Google.",
    ],
  },
  {
    slug: "cuando-no-puedo-responder",
    question: "Qué hago cuando no puedo responder",
    body: [
      "A veces el motor no tiene evidencia suficiente para darte una cifra con confianza, y prefiere decírtelo antes que inventar un número.",
      "En esos casos te digo qué me falta y te llevo a la vía manual — la pantalla donde puedes verlo o hacerlo tú mismo.",
      "Nunca invento una respuesta sobre cómo funciona el producto: si no tengo un artículo que la responda, te lo digo y te ofrezco escribir a soporte.",
    ],
  },
];

export function findHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}
