<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateArtworkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'           => ['sometimes', 'string', 'max:255'],
            'description'     => ['sometimes', 'nullable', 'string', 'max:5000'],
            'sort_order'      => ['sometimes', 'integer'],
            'animation_style' => ['sometimes', 'string', 'in:fade,mask-reveal,parallax'],
            'price_cents'     => ['sometimes', 'nullable', 'integer', 'min:0', 'max:99999999'],
            'currency'        => ['sometimes', 'required_with:price_cents', 'nullable', 'string', 'size:3'],
            'is_available'    => ['sometimes', 'boolean'],
        ];
    }
}