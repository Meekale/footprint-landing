import math


def projected_width_mm(points, width, height, reference_mm):
    """Ratio of two user-marked image-plane distances; not tissue thickness."""
    if not math.isfinite(reference_mm) or not 5 <= reference_mm <= 40:
        raise ValueError('Measure the reference fingernail width in millimeters (5–40 mm).')
    if len(points) != 4 or width <= 0 or height <= 0:
        raise ValueError('Mark two reference edges, followed by two visible fold edges.')
    for point in points:
        if len(point) != 2 or any(not math.isfinite(v) or not 0 <= v <= 1 for v in point):
            raise ValueError('All marked points must be inside the photograph.')

    def distance(a, b):
        return math.hypot((a[0] - b[0]) * width, (a[1] - b[1]) * height)

    reference_px = distance(*points[:2])
    fold_px = distance(*points[2:])
    if reference_px < 15 or fold_px < 5:
        raise ValueError('The reference or fold is too small. Move closer while keeping both in focus.')
    value = fold_px / reference_px * reference_mm
    if not 1 <= value <= 100:
        raise ValueError('Check the four marked edges and the reference measurement.')
    return value
