import type { BookingIssue } from "@/domain/booking-rules";
import { hhmm } from "@/domain/time";

export interface Names {
  barber: (id: string) => string;
  unit: (id: string | null) => string;
  person: (id: string) => string;
}

/** Plain-language text for each booking problem, shared by the screen and the server. */
export function issueMessage(issue: BookingIssue, n: Names): string {
  switch (issue.code) {
    case "missing_barber":
      return "Escolha o profissional para ver os horários.";
    case "unknown_barber":
      return "Esse profissional não está mais disponível para agendamento. Escolha outro.";
    case "barber_other_unit":
      return `${n.barber(issue.barberId)} atende na unidade ${n.unit(issue.barberUnitId)}, não na ${n.unit(issue.unitId)}.`;
    case "person_busy":
      return `${n.person(issue.customerId)} já tem horário às ${hhmm(issue.start)} nesse dia (unidade ${n.unit(issue.unitId)}). Escolha outro horário.`;
    case "slot_unavailable":
      return "Esse horário não está mais livre para essa escolha. Escolha outro.";
  }
}
