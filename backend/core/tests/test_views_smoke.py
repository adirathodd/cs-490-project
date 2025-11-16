import pytest


def test_views_module_importable():
    # smoke test: ensure the views module imports and exposes expected entrypoints
    import core.views as views

    # spot-check a few view callables exist
    assert hasattr(views, 'contacts_list_create')
    assert hasattr(views, 'contact_detail')
    assert callable(getattr(views, 'contacts_list_create'))
    assert callable(getattr(views, 'contact_detail'))
