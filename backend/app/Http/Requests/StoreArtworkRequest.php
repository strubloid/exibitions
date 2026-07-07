<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreArtworkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'           => ['required', 'string', 'max:255'],
            'description'     => ['nullable', 'string', 'max:5000'],
            'sort_order'      => ['sometimes', 'integer'],
            'animation_style' => ['sometimes', 'string', 'in:fade,mask-reveal,parallax'],
            'price_cents'     => ['nullable', 'integer', 'min:0', 'max:99999999'],
            'currency'        => ['required_with:price_cents', 'nullable', 'string', 'size:3'],
            'is_available'    => ['sometimes', 'boolean'],
        ];
    }
}