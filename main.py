"""Tonkotsu Noodle Pull - entry program for food-picture-01 (v3).

The repository holds the finished food picture as entry.png beside
this file (a JPEG, told apart from a PNG by its first bytes, exactly
as the competition gate allows: the file name stays entry.png either
way). This program's whole job is to deliver those bytes, untouched,
to the output: it validates the picture against every limit the gate
enforces, then writes it out as entry.png.

The picture: a bowl of tonkotsu ramen on a dark table, shot as
editorial food photography. Chopsticks lift a tall, glossy pull of
noodles out of rich creamy broth; two halved ajitama eggs with jammy
glossy yolks and glistening chashu slices sit in the bowl, steam
rising through warm side light against the dark background. One
clear dish, readable at a glance and at thumbnail size.

Pure Python 3 standard library, fully deterministic: copying the
same bytes twice produces byte-identical output on every run, as
the competition requires (the program is run twice and both runs
must write the same bytes). No network, no clock, no randomness.
"""

import os
import struct

MAX_BYTES = 1048576  # the gate's cap: at most 1 MiB
MAX_WIDTH = 1024
MAX_HEIGHT = 1024
ENTRY_NAME = "entry.png"  # the shipped image / output file name

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"
JPEG_END = b"\xff\xd9"
PNG_IEND = b"IEND\xaeB`\x82"


def png_dimensions(data):
    """Width and height from the PNG IHDR chunk (offsets 16 and 20)."""
    if len(data) < 24:
        raise ValueError("entry.png is a truncated PNG (no complete IHDR)")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def jpeg_dimensions(data):
    """Width and height from the first JPEG start-of-frame segment.

    JPEG layout: a chain of segments, each FF <marker> <length as a
    big-endian uint16> <payload>. The start-of-frame markers (C0-CF
    except C4, C8 and CC) carry precision (1 byte), then height and
    width as big-endian uint16s.
    """
    offset = 2  # skip the SOI marker (FF D8)
    while offset + 4 <= len(data):
        if data[offset] != 0xFF:
            raise ValueError("entry.png is a malformed JPEG (lost segment sync)")
        marker = data[offset + 1]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            offset += 2  # standalone markers carry no length field
            continue
        seg_len = struct.unpack(">H", data[offset + 2 : offset + 4])[0]
        if seg_len < 2:
            raise ValueError("entry.png is a malformed JPEG (bad segment length)")
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            if offset + 9 > len(data):
                raise ValueError("entry.png is a truncated JPEG (short SOF)")
            height, width = struct.unpack(">HH", data[offset + 5 : offset + 9])
            return width, height
        offset += 2 + seg_len
    raise ValueError("entry.png has no JPEG start-of-frame segment")


def assert_within_limits(width, height):
    if width > MAX_WIDTH or height > MAX_HEIGHT:
        raise ValueError(
            "entry.png is %dx%d, over the %dx%d cap"
            % (width, height, MAX_WIDTH, MAX_HEIGHT)
        )


def check_picture(data):
    """Raise ValueError unless data is a whole PNG or JPEG picture
    within every limit the competition's gate enforces."""
    if len(data) == 0:
        raise ValueError("entry.png is empty")
    if len(data) > MAX_BYTES:
        raise ValueError("entry.png is larger than the 1 MiB cap")
    if data.startswith(PNG_MAGIC):
        if not data.rstrip(b"\x00").endswith(PNG_IEND):
            raise ValueError("entry.png is not a whole PNG (no IEND chunk)")
        width, height = png_dimensions(data)
    elif data.startswith(JPEG_MAGIC):
        if not data.endswith(JPEG_END):
            raise ValueError("entry.png is not a whole JPEG (no end marker)")
        width, height = jpeg_dimensions(data)
    else:
        raise ValueError("entry.png starts with neither PNG nor JPEG magic")
    assert_within_limits(width, height)
    return width, height


def deliver(data):
    """Write the validated image bytes to the output directory."""
    out_dir = os.environ.get("MAKEFUN_OUTPUT_DIR", "/output")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, ENTRY_NAME), "wb") as fh:
        fh.write(data)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, ENTRY_NAME), "rb") as fh:
        data = fh.read()
    check_picture(data)
    deliver(data)


if __name__ == "__main__":
    main()
