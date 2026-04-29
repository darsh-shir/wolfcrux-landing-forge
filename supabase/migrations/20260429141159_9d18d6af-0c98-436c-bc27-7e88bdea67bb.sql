CREATE TRIGGER trg_sync_milestone_config
BEFORE INSERT OR UPDATE OF config_mode ON public.trader_config
FOR EACH ROW EXECUTE FUNCTION public.sync_milestone_config_on_mode_change();