import { firstName } from "./format";

/** wa.me link with a ready message, opened from the owner's phone or WhatsApp Web. */
export function whatsappMessage(phone: string, text: string): string {
  return `https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const messages = {
  invite: (name: string, plan: string, saving: string) =>
    `Oi, ${firstName(name)}! Aqui é da Mister Bigode. Pelo seu ritmo de visitas, no ${plan} você pagaria ${saving} a menos por mês. Quer que eu ative pra você?`,
  lateReminder: (name: string) => `Oi, ${firstName(name)}! Sentimos sua falta na Mister Bigode. Seu clube está ativo, quer que eu reserve um horário essa semana?`,
  pastDue: (name: string) =>
    `Oi, ${firstName(name)}! A cobrança do seu Mister Club não passou no cartão. Posso te mandar um Pix ou você prefere atualizar o cartão pelo app?`,
  lead: (name: string, plan: string) => `Oi, ${firstName(name)}! Recebemos seu pedido do ${plan} pelo app. Posso confirmar e ativar pra você?`,
};
