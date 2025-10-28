from django.core.management.base import BaseCommand, CommandError
from django.db import models as dj_models
from django.utils.timezone import is_aware
from decimal import Decimal
from typing import Iterable, List, Optional, Tuple

try:
    from core import models as core_models
except Exception as e:
    core_models = None


def _model_fields(model: dj_models.Model) -> List[str]:
    return [f.name for f in model._meta.fields]


def _instance_to_row(instance: dj_models.Model, max_len: int = 120) -> dict:
    row = {}
    for f in instance._meta.fields:
        val = getattr(instance, f.name)
        # Render related fields by their primary key only
        if isinstance(f, (dj_models.ForeignKey, dj_models.OneToOneField)):
            row[f.name] = getattr(val, 'pk', None)
        else:
            try:
                if val is None:
                    row[f.name] = None
                elif isinstance(val, (int, float, Decimal)):
                    row[f.name] = val
                elif hasattr(val, 'isoformat'):
                    # Date/DateTime
                    try:
                        row[f.name] = val.isoformat()
                    except Exception:
                        row[f.name] = str(val)
                else:
                    s = str(val)
                    if len(s) > max_len:
                        s = s[: max_len - 3] + '...'
                    row[f.name] = s
            except Exception:
                row[f.name] = str(val)
    return row


def _print_section(title: str):
    line = '=' * len(title)
    print(f"\n{title}\n{line}")


class Command(BaseCommand):
    help = "Display information from important database tables in a readable format."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Include all models in core app instead of the curated important set.",
        )
        parser.add_argument(
            "--models",
            nargs="*",
            default=None,
            help="Specific model names to include (e.g., UserAccount CandidateProfile Education). Case-sensitive.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=10,
            help="Max rows to display per model (default: 10)",
        )
        parser.add_argument(
            "--order",
            default=None,
            help="Optional ordering (e.g., -created_at). If not provided, model default ordering is used.",
        )

    def handle(self, *args, **options):
        if core_models is None:
            raise CommandError("Could not import core.models. Is the app installed and Django configured?")

        curated: List[Tuple[str, dj_models.Model]] = [
            ("UserAccount", core_models.UserAccount),
            ("CandidateProfile", core_models.CandidateProfile),
            ("Education", core_models.Education),
            ("Certification", core_models.Certification),
            ("Skill", core_models.Skill),
            ("CandidateSkill", core_models.CandidateSkill),
            ("Project", core_models.Project),
            ("Document", core_models.Document),
            ("Application", core_models.Application),
            ("Interview", core_models.Interview),
            ("AccountDeletionRequest", core_models.AccountDeletionRequest),
            ("Company", core_models.Company),
            ("JobOpportunity", core_models.JobOpportunity),
        ]

        limit: int = options["limit"]
        order: Optional[str] = options["order"]

        # Resolve model selection
        include_models: List[Tuple[str, dj_models.Model]]
        if options["models"]:
            name_map = {name: model for name, model in curated}
            # Also allow any model from core.models when explicitly requested
            for m in core_models.__dict__.values():
                if isinstance(m, type) and issubclass(m, dj_models.Model) and m.__module__.endswith("core.models"):
                    name_map[m.__name__] = m

            include_models = []
            unknown = []
            for name in options["models"]:
                model = name_map.get(name)
                if not model:
                    unknown.append(name)
                else:
                    include_models.append((name, model))
            if unknown:
                raise CommandError(f"Unknown model name(s): {', '.join(unknown)}")
        elif options["all"]:
            include_models = []
            # Collect all concrete model classes defined in core.models
            for attr_name, m in sorted(core_models.__dict__.items()):
                if (
                    isinstance(m, type)
                    and issubclass(m, dj_models.Model)
                    and m is not dj_models.Model
                    and getattr(m._meta, 'abstract', False) is False
                    and m.__module__.endswith("core.models")
                ):
                    include_models.append((m.__name__, m))
        else:
            include_models = curated

        if not include_models:
            self.stdout.write(self.style.WARNING("No models selected to display."))
            return

        for name, model in include_models:
            try:
                qs = model.objects.all()
                if order:
                    qs = qs.order_by(order)
                count = qs.count()
            except Exception as e:
                _print_section(f"{name}")
                print(f"Error accessing model {name}: {e}")
                continue

            _print_section(f"{name} (count={count})")

            if count == 0:
                print("<no rows>")
                continue

            rows = qs[:limit]
            fields = _model_fields(model)
            print(f"Fields: {', '.join(fields)}")

            for obj in rows:
                data = _instance_to_row(obj)
                print("- ", data)

        self.stdout.write(self.style.SUCCESS("Done."))
