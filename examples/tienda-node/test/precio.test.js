import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precioFinal } from '../src/precio.js';

test('aplica el IVA general del 21 %', () => {
  assert.equal(precioFinal(100), 121);
});

test('aplica el descuento antes del IVA', () => {
  assert.equal(precioFinal(100, { descuento: 0.1 }), 108.9);
});

test('admite otro tipo de IVA', () => {
  assert.equal(precioFinal(10, { iva: 0.1 }), 11);
});

test('redondea a céntimos', () => {
  assert.equal(precioFinal(9.99), 12.09);
});

test('rechaza precios negativos', () => {
  assert.throws(() => precioFinal(-1), TypeError);
});
