<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateArtworkPriceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'price_cents'  => ['sometimes', 'nullable', 'integer', 'min:0', 'max:99999999'],
            'currency'     => ['sometimes', 'required_with:price_cents', 'nullable', 'string', 'size:3'],
            'is_available' => ['sometimes', 'boolean'],
        ];
    }
}