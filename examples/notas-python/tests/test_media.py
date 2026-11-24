import unittest

from notas.media import aprobados, media


class MediaTest(unittest.TestCase):
    def test_media(self):
        self.assertEqual(media([5, 7, 9]), 7)

    def test_redondea(self):
        self.assertEqual(media([7, 8, 8]), 7.67)

    def test_sin_notas(self):
        with self.assertRaises(ValueError):
            media([])

    def test_fuera_de_rango(self):
        with self.assertRaises(ValueError):
            media([11])

    def test_aprobados(self):
        self.assertEqual(aprobados([4.9, 5, 10]), 2)


if __name__ == "__main__":
    unittest.main()
