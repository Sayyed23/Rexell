"""Rexell ML training helpers shared across the notebooks.

Importable from any notebook in ``ml-training/notebooks`` via::

    import sys, pathlib
    sys.path.append(str(pathlib.Path.cwd().parent / "src"))
    from rexell_ml import data, features, metrics, plots, synth
"""

from rexell_ml import data, features, metrics, plots, synth  # noqa: F401

__all__ = ["data", "features", "metrics", "plots", "synth"]
