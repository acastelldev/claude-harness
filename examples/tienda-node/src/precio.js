// Precio final de un producto: descuento sobre la base y luego IVA. Redondeado a céntimos.
export function precioFinal(base, { iva = 0.21, descuento = 0 } = {}) {
  if (typeof base !== 'number' || !Number.isFinite(base) || base < 0) {
    throw new TypeError('base debe ser un número mayor o igual que 0');
  }
  if (descuento < 0 || descuento > 1) {
    throw new RangeError('descuento va de 0 a 1');
  }
  const conDescuento = base * (1 - descuento);
  return Math.round(conDescuento * (1 + iva) * 100) / 100;
}
