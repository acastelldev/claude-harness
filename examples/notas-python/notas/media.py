"""Notas de una clase (datos inventados)."""


def media(notas):
    """Media de una lista de notas de 0 a 10, redondeada a dos decimales."""
    if not notas:
        raise ValueError("no hay notas")
    for n in notas:
        if not 0 <= n <= 10:
            raise ValueError(f"nota fuera de rango: {n}")
    return round(sum(notas) / len(notas), 2)


def aprobados(notas, corte=5):
    """Cuántas notas llegan al corte."""
    return sum(1 for n in notas if n >= corte)
