-- Ejecutar una sola vez en el SQL Editor de Supabase, antes de publicar esta versión.
-- No contiene datos personales ni borra invitados o entregas.
BEGIN;
LOCK TABLE public.invitados IN ACCESS EXCLUSIVE MODE;
-- Una entrega parcial mixta no permite saber qué regalo recibió cada persona.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.invitados
    WHERE adultos > 0 AND ninos > 0 AND cantidad_entregada > 0
      AND cantidad_entregada < adultos + ninos) THEN
    RAISE EXCEPTION 'Existen entregas parciales en grupos con adultos y niños. Hay que clasificar esas entregas antes de migrar; no se ha modificado ningún dato.';
  END IF;
END $$;
ALTER TABLE public.invitados
  ADD COLUMN adultos_entregados integer NOT NULL DEFAULT 0,
  ADD COLUMN ninos_entregados integer NOT NULL DEFAULT 0;
UPDATE public.invitados SET
  adultos_entregados = CASE WHEN ninos = 0 THEN cantidad_entregada WHEN cantidad_entregada = adultos + ninos THEN adultos ELSE 0 END,
  ninos_entregados = CASE WHEN adultos = 0 THEN cantidad_entregada WHEN cantidad_entregada = adultos + ninos THEN ninos ELSE 0 END;
ALTER TABLE public.invitados
  ADD CONSTRAINT invitados_adultos_entregados_validos CHECK (adultos_entregados BETWEEN 0 AND adultos),
  ADD CONSTRAINT invitados_ninos_entregados_validos CHECK (ninos_entregados BETWEEN 0 AND ninos),
  ADD CONSTRAINT invitados_entregas_suman CHECK (cantidad_entregada = adultos_entregados + ninos_entregados);
NOTIFY pgrst, 'reload schema';
COMMIT;
