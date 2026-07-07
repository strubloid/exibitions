<?php

namespace App\Services;

use InvalidArgumentException;
use NumberFormatter;

final class PricingService
{
    /**
     * Convert a major-unit decimal (e.g. "1200.00" or 1200.0) to integer minor units.
     * Rejects NaN/Inf explicitly so a malformed input never silently becomes 0.
     */
    public function toMinorUnits(string|int|float $major): int
    {
        $value = (float) $major;
        if (!is_finite($value)) {
            throw new InvalidArgumentException('Cannot convert non-finite value to minor units.');
        }

        return (int) round($value * 100);
    }

    /**
     * Format a minor-unit amount as a display string, e.g. 1200 cents USD => "$12.00".
     * Builds a plain numeric representation server-side so the frontend can rely
     * on Intl.NumberFormat for display, but we log/return a stable format.
     */
    public function format(int $minor, string $currency): string
    {
        if (class_exists(NumberFormatter::class)) {
            $fmt = new NumberFormatter('en_US', NumberFormatter::CURRENCY);
            $formatted = $fmt->formatCurrency($minor / 100, $currency);
            if ($formatted !== false) {
                return $formatted;
            }
        }

        return sprintf('%.2f %s', $minor / 100, $currency);
    }
}