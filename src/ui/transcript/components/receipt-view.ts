import { buildReceiptModel } from "../../receipt-model.js";
import { formatReceiptText } from "../../receipt-text.js";

export const renderReceiptForRun = (runDir: string): string => {
  const model = buildReceiptModel(runDir);
  return formatReceiptText(model).trimEnd();
};
