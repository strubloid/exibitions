<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items'                     => ['required', 'array', 'min:1', 'max:50'],
            'items.*.artwork_id'        => ['required', 'integer', 'exists:artworks,id'],
            'customer'                  => ['required', 'array'],
            'customer.email'            => ['required', 'email:rfc'],
            'customer.name'             => ['required', 'string', 'min:1', 'max:255'],
            'customer.shipping'         => ['required', 'array'],
            'customer.shipping.line1'   => ['required', 'string', 'max:255'],
            'customer.shipping.line2'   => ['nullable', 'string', 'max:255'],
            'customer.shipping.city'    => ['required', 'string', 'max:120'],
            'customer.shipping.postal_code' => ['required', 'string', 'max:20'],
            'customer.shipping.country' => ['required', 'string', 'size:2', 'regex:/^[A-Z]{2}$/i', function ($attribute, $value, $fail) {
                // Validate against a small allowlist of common ISO 3166-1 alpha-2 codes.
                // We avoid the Symfony\Intl dependency (not bundled with every PHP image) here.
                $allowed = ['US','GB','CA','AU','NZ','IE','DE','FR','IT','ES','PT','NL','BE','AT','CH','SE','NO','DK','FI','PL','CZ','RO','BG','HR','SK','SI','EE','LV','LT','GR','CY','MT','LU','JP','KR','CN','HK','SG','MY','TH','ID','PH','VN','IN','PK','BD','AE','SA','IL','TR','BR','AR','CL','CO','PE','MX','ZA','EG','MA','NG','KE','RU','UA'];
                if (!in_array(strtoupper($value), $allowed, true)) {
                    $fail('Invalid ISO 3166-1 alpha-2 country code.');
                }
            }],
            'customer.shipping.state'   => ['nullable', 'string', 'max:120'],
            'success_url'               => ['required', 'url', function ($attribute, $value, $fail) {
                $expected = rtrim(config('app.frontend_url'), '/') . '/';
                if (!str_starts_with($value, $expected)) {
                    $fail('success_url must start with the frontend origin.');
                }
            }],
        ];
    }
}