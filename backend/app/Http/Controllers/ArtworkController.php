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

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'           => 'required|string|max:255',
            'description'     => 'nullable|string',
            'sort_order'      => 'integer',
            'animation_style' => 'string|in:fade,mask-reveal,parallax',
        ]);

        $artwork = Artwork::create($data);

        return response()->json($artwork, 201);
    }

    public function update(Request $request, Artwork $artwork): JsonResponse
    {
        $data = $request->validate([
            'title'           => 'sometimes|string|max:255',
            'description'     => 'nullable|string',
            'sort_order'      => 'sometimes|integer',
            'animation_style' => 'sometimes|string|in:fade,mask-reveal,parallax',
        ]);

        $artwork->update($data);

        return response()->json($artwork->fresh());
    }

    public function destroy(Artwork $artwork): JsonResponse
    {
        $artwork->delete();

        return response()->json(null, 204);
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

        // Extract dominant palette before destroying the source
        $palette = $this->extractPalette($source);

        // Save full-quality WebP (Q85)
        imagewebp($source, $dir . '/' . $filename, 85);

        // Generate compressed version (max 1200px longest edge, Q60)
        $compressedFilename = $artwork->id . '-compressed.webp';
        $this->generateCompressedImage($source, $dir . '/' . $compressedFilename);

        imagedestroy($source);

        $artwork->update([
            'image'            => '/storage/artworks/' . $filename,
            'image_compressed' => '/storage/artworks/' . $compressedFilename,
            'metadata'         => array_merge($artwork->metadata ?? [], ['palette' => $palette]),
        ]);

        return response()->json($artwork->fresh());
    }

    private function generateCompressedImage(\GdImage $source, string $outputPath, int $maxEdge = 1200, int $quality = 60): void
    {
        $originalWidth = imagesx($source);
        $originalHeight = imagesy($source);

        if ($originalWidth <= $maxEdge && $originalHeight <= $maxEdge) {
            // Already small enough — just save at lower quality
            imagewebp($source, $outputPath, $quality);
            return;
        }

        // Scale so longest edge = maxEdge
        if ($originalWidth >= $originalHeight) {
            $newWidth = $maxEdge;
            $newHeight = (int) round($originalHeight * ($maxEdge / $originalWidth));
        } else {
            $newHeight = $maxEdge;
            $newWidth = (int) round($originalWidth * ($maxEdge / $originalHeight));
        }

        $resized = imagecreatetruecolor($newWidth, $newHeight);
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $originalWidth, $originalHeight);
        imagewebp($resized, $outputPath, $quality);
        imagedestroy($resized);
    }

    private function extractPalette(\GdImage $img): array
    {
        $w = imagesx($img);
        $h = imagesy($img);

        // Sample 3 zones: full image average, center crop, bottom third
        $zones = [
            [0,                   0,                   $w,              $h             ],
            [(int)($w * 0.25),    (int)($h * 0.25),    (int)($w * 0.5), (int)($h * 0.5)],
            [0,                   (int)($h * 0.65),    $w,              (int)($h * 0.35)],
        ];

        $colors = [];
        foreach ($zones as [$x, $y, $zw, $zh]) {
            if ($zw < 1 || $zh < 1) continue;
            $thumb = imagecreatetruecolor(1, 1);
            imagecopyresampled($thumb, $img, 0, 0, $x, $y, 1, 1, $zw, $zh);
            $rgb      = imagecolorat($thumb, 0, 0);
            $colors[] = sprintf('#%02x%02x%02x', ($rgb >> 16) & 0xFF, ($rgb >> 8) & 0xFF, $rgb & 0xFF);
            imagedestroy($thumb);
        }

        return $colors;
    }
}
