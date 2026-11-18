"""Published Jackson-Pollock three-site density + Siri conversion.

Sources: Jackson & Pollock (1978), doi:10.1079/BJN19780152;
Jackson, Pollock & Ward (1980), PMID:7402053.
These equations estimate body composition; they do not validate photo measurements.
"""
import math
import statistics

PROTOCOLS = {
    'male': ('chest', 'abdomen', 'thigh'),
    'female': ('triceps', 'suprailiac', 'thigh'),
}


def estimate_body_fat(equation, age, measurements):
    if equation not in PROTOCOLS:
        raise ValueError('Choose the male or female study equation.')
    max_age = 61 if equation == 'male' else 55
    if not isinstance(age, (int, float)) or not math.isfinite(age) or not 18 <= age <= max_age:
        raise ValueError(f'This equation supports ages 18–{max_age} in this prototype.')
    if set(measurements) != set(PROTOCOLS[equation]):
        raise ValueError('Complete exactly the three sites required by your equation.')
    medians = {}
    for site, values in measurements.items():
        if len(values) != 3:
            raise ValueError(f'{site}: three independent readings are required.')
        if any(not isinstance(v, (int, float)) or not math.isfinite(v) or not 2 <= v <= 60 for v in values):
            raise ValueError(f'{site}: readings must be finite values from 2 to 60 mm.')
        median = statistics.median(values)
        if max(values) - min(values) > max(2, .15 * median):
            raise ValueError(f'{site}: readings vary too much. Release, reposition and repeat this site.')
        medians[site] = median
    total = sum(medians.values())
    # Both fitted polynomials eventually reverse direction; never extrapolate there.
    limit = 180 if equation == 'male' else 170
    if total > limit:
        raise ValueError('The sum of measurements exceeds this prototype’s supported range.')
    if equation == 'male':
        density = 1.10938 - .0008267 * total + .0000016 * total**2 - .0002574 * age
    else:
        density = 1.0994921 - .0009929 * total + .0000023 * total**2 - .0001392 * age
    fat = 495 / density - 450
    if not 2 <= fat <= 60:
        raise ValueError('The estimate falls outside the supported range. Check the measurements.')
    return {
        'body_fat_percent': round(fat, 1),
        'body_density': density,
        'site_medians_mm': medians,
        'method': 'Jackson–Pollock 3-site / Siri',
        'note': 'An equation-based estimate, not a clinical measurement. Individual error is not established by this app.',
    }
