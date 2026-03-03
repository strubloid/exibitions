<?php

namespace App\Http\Controllers;

use App\Models\Artwork;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArtworkController extends Controller
{
    public function index(): JsonResponse
    {
        $artworks = Artwork::orderBy('sort_order')->get();

        return response()->json($artworks);
    }

    public function uploadImage(Request $request, Artwork $artwork): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|max:30720',
        ]);

        $file = $request->file('image');
        $filename = $artwork->id . '.webp';
        $dir = storage_path('app/public/artworks');

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        // Load source image with GD
        $mime = $file->getMimeType();
        $source = match (true) {
            str_contains($mime, 'jpeg') => imagecreatefromjpeg($file->getRealPath()),
            str_contains($mime, 'png')  => imagecreatefrompng($file->getRealPath()),
            str_contains($mime, 'webp') => imagecreatefromwebp($file->getRealPath()),
            default                     => imagecreatefromjpeg($file->getRealPath()),
        };

        // Convert and save as WebP at quality 85
        imagewebp($source, $dir . '/' . $filename, 85);
        imagedestroy($source);

        $artwork->update([
            'image' => '/storage/artworks/' . $filename,
        ]);

        return response()->json($artwork->fresh());
    }
}
