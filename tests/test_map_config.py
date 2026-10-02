from statemap.map_config import DEFAULT_SECTIONS, read_sections


def write(tmp_path, text):
    p = tmp_path / "map-sections.yaml"
    p.write_text(text)
    return p


def test_order_and_cap_are_read(tmp_path):
    p = write(tmp_path, "# mine\nsections:\n  - systems\n  - due_today  # first thing\nbrief_list_cap: 3\nverbose_list_cap: 7\n")
    cfg = read_sections(p)
    assert (cfg.names, cfg.brief_cap, cfg.verbose_cap, cfg.problems) == (["systems", "due_today"], 3, 7, [])


def test_missing_file_uses_defaults_and_says_so(tmp_path):
    cfg = read_sections(tmp_path / "nope.yaml")
    assert cfg.names == DEFAULT_SECTIONS and cfg.brief_cap == 2 and cfg.verbose_cap == 5 and cfg.expected_off == []
    assert cfg.problems == ["map sections file missing; using the default list"]


def test_lines_it_cannot_read_are_reported_not_ignored(tmp_path):
    p = write(tmp_path, "sections:\n  - next_up\nbrief_list_cap: lots\nvoice: loud\n")
    cfg = read_sections(p)
    assert cfg.names == ["next_up"] and cfg.brief_cap == 2
    assert len(cfg.problems) == 2


def test_an_empty_list_falls_back(tmp_path):
    cfg = read_sections(write(tmp_path, "sections:\n"))
    assert cfg.names == DEFAULT_SECTIONS and cfg.problems


def test_a_file_that_isnt_utf8_falls_back_and_says_so(tmp_path):
    p = tmp_path / "map-sections.yaml"
    p.write_bytes(b"sections:\n  - due_\xff\n")
    cfg = read_sections(p)
    assert cfg.names == DEFAULT_SECTIONS and cfg.problems == ["map sections file unreadable; using the default list"]


def test_quotes_are_accepted_and_duplicates_reported(tmp_path):
    cfg = read_sections(write(tmp_path, 'sections:\n  - "due_today"\n  - \'systems\'\n  - systems\n'))
    assert cfg.names == ["due_today", "systems"]
    assert cfg.problems == ["map sections file line 4: systems is listed twice"]


def test_expected_off_is_read(tmp_path):
    # Operator-declared "off by choice" (2026-10-01, no expiry); inline comments carry the reason.
    cfg = read_sections(write(tmp_path, "sections:\n  - systems\nexpected_off:\n  - git-knowledge-loom-1   # vendored source too old\n  - phone-agent\n"))
    assert cfg.names == ["systems"] and cfg.expected_off == ["git-knowledge-loom-1", "phone-agent"] and cfg.problems == []
