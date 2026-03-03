<?php

namespace App\Http\Controllers;

use App\Models\Artwork;
use Illuminate\Http\JsonResponse;

class ArtworkController extends Controller
{
    public function index(): JsonResponse
    {
        $artworks = Artwork::orderBy('sort_order')->get();

        return response()->json($artworks);
    }
}
