from statemap.map_config import DEFAULT_SECTIONS, read_sections


def write(tmp_path, text):
    p = tmp_path / "map-sections.yaml"
    p.write_text(text)
    return p


def test_order_and_cap_are_read(tmp_path):
    p = write(tmp_path, "# mine\nsections:\n  - systems\n  - due_today  # first thing\nbrief_list_cap: 3\nverbose_list_cap: 7\n")
    assert read_sections(p) == (["systems", "due_today"], 3, 7, [])


def test_missing_file_uses_defaults_and_says_so(tmp_path):
    names, cap, vcap, problems = read_sections(tmp_path / "nope.yaml")
    assert names == DEFAULT_SECTIONS and cap == 2 and vcap == 5
    assert problems == ["map sections file missing; using the default list"]


def test_lines_it_cannot_read_are_reported_not_ignored(tmp_path):
    p = write(tmp_path, "sections:\n  - next_up\nbrief_list_cap: lots\nvoice: loud\n")
    names, cap, vcap, problems = read_sections(p)
    assert names == ["next_up"] and cap == 2
    assert len(problems) == 2


def test_an_empty_list_falls_back(tmp_path):
    names, _, _, problems = read_sections(write(tmp_path, "sections:\n"))
    assert names == DEFAULT_SECTIONS and problems
