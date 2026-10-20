# Créditos de imágenes

Las fotos de las demos salen de [Pexels](https://www.pexels.com/license/) y se usan bajo la **licencia de Pexels**.
Autor, título y licencia ("Free") se comprobaron en la ficha de cada foto el 19 de octubre de 2026.

## Qué permite y qué no la licencia (según su página)

- **Permite:** uso gratuito, incluido el comercial; no exige dar crédito; se pueden modificar.
- **No permite:** vender copias sin modificar; redistribuir las fotos en otras plataformas de imágenes; usarlas
  como parte de una marca, nombre comercial o logotipo; mostrar a personas identificables de forma ofensiva ni
  **"insinuar que esas personas o marcas respaldan tu producto"**.

Aunque no pide crédito, se deja aquí por transparencia y para poder reemplazar cada imagen con facilidad.

## Fotos en uso

| Archivo | Se usa como | Título en Pexels | Autor | Ficha |
| --- | --- | --- | --- | --- |
| `public/tenants/don-carlos/portada.jpg` | Portada de Barbería Don Carlos | The Interior of a Barber Shop | [Pavel Danilyuk](https://www.pexels.com/@pavel-danilyuk/) | [7518728](https://www.pexels.com/photo/the-interior-of-a-barber-shop-7518728/) |
| `public/tenants/don-carlos/carlos.jpg` | Retrato de "Carlos" | A Barber Smiling at his Client in a Barbershop | [RDNE Stock project](https://www.pexels.com/@rdne/) | [7697322](https://www.pexels.com/photo/a-barber-smiling-at-his-client-in-a-barbershop-7697322/) |
| `public/tenants/don-carlos/andres.jpg` | Retrato de "Andrés" | Bearded Man Smiling with his Arms Crossed | [Cedric Fauntleroy](https://www.pexels.com/@cedric-fauntleroy/) | [7221513](https://www.pexels.com/photo/bearded-man-smiling-with-his-arms-crossed-7221513/) |
| `public/tenants/don-carlos/mateo.jpg` | Retrato de "Mateo" | A Man Wearing an Apron | [Kampus Production](https://www.pexels.com/@kampus/) | [8475183](https://www.pexels.com/photo/a-man-wearing-an-apron-8475183/) |
| `public/tenants/clinica-sonrisa/portada.jpg` | Portada de Clínica Dental Sonrisa | A Dental Equipment in the Clinic | [Pavel Danilyuk](https://www.pexels.com/@pavel-danilyuk/) | [6812453](https://www.pexels.com/photo/a-dental-equipment-in-the-clinic-6812453/) |
| `public/tenants/clinica-sonrisa/dra-mejia.jpg` | Retrato de "Dra. Laura Mejía" | Smiling Doctor with Stethoscope in Pocket | [Tessy Agbonome](https://www.pexels.com/@tessy-agbonome-521343232/) | [19131217](https://www.pexels.com/photo/smiling-doctor-with-stethoscope-in-pocket-19131217/) |
| `public/tenants/clinica-sonrisa/dr-pardo.jpg` | Retrato de "Dr. Andrés Pardo" | A Doctor Smiling while Leaning on the Table | [Ivan S](https://www.pexels.com/@ivan-s/) | [4989168](https://www.pexels.com/photo/a-doctor-smiling-while-leaning-on-the-table-4989168/) |
| `public/tenants/clinica-sonrisa/dra-ruiz.jpg` | Retrato de "Dra. Camila Ruiz" | A Woman Wearing a Stethoscope | [Antoni Shkraba](https://www.pexels.com/@shkrabaanthony/) | [6749773](https://www.pexels.com/photo/a-woman-wearing-a-stethoscope-6749773/) |

**Modificaciones hechas:** recorte (portadas 3:2 y retratos 4:5), reducción de tamaño y compresión JPEG sin
metadatos. En la portada de la barbería se **difuminó un cartel de una marca** visible en la ventana.

## Importante: personas reales en una demo con equipo ficticio

Los retratos son de personas reales que **no trabajan** en estos negocios: aparecen con nombres inventados
("Carlos", "Dra. Laura Mejía") porque la demo muestra datos ficticios (así lo avisa la franja superior). Para
respetar la licencia y no engañar a nadie:

- No uses estas demos como si fueran el equipo real de un negocio.
- Al preparar la demo de un prospecto real, **reemplaza estos retratos por fotos de su propio equipo** (o quita
  el campo `foto` y se muestran las iniciales).
- Las fotos del consultorio son de médicos con estetoscopio, no de odontólogos: sirven para la demo, no para un
  negocio real.

## Cómo reemplazar una foto

1. Pon la imagen nueva en `public/tenants/<slug>/` (JPG, PNG o WebP; portadas de ~1920×1280, retratos ~800×1000).
2. Cambia la ruta en el JSON del negocio: `imagenPortada` para la portada, `foto` en cada profesional.
3. Si la imagen no es tuya, anota aquí su autor, enlace y licencia.
