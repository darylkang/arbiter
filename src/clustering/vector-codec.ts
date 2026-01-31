export const decodeFloat32Base64 = (base64: string): number[] => {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength % 4 !== 0) {
    throw new Error("Embedding byte length is not divisible by 4");
  }
  const array = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
  return Array.from(array);
};

export const encodeFloat32Base64 = (vector: number[]): string => {
  const array = new Float32Array(vector);
  const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  return buffer.toString("base64");
};
