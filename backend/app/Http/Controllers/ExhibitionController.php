<?php

namespace App\Http\Controllers;

use App\Models\Exhibition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ExhibitionController extends Controller
{
    public function index(): JsonResponse
    {
        $exhibitions = Exhibition::orderBy('sort_order')->get();

        return response()->json($exhibitions);
    }

    public function show(string $slug): JsonResponse
    {
        $exhibition = Exhibition::where('slug', $slug)->with([
            'artworks' => fn ($q) => $q->orderByPivot('sort_order'),
        ])->firstOrFail();

        return response()->json($exhibition);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string',
            'background'  => 'nullable|string',
            'clippings'   => 'nullable|array',
            'clippings.*.title'            => 'required|string|max:255',
            'clippings.*.screenshot_image' => 'nullable|string',
            'slug'        => 'nullable|string|max:255|unique:exhibitions',
            'sort_order'  => 'integer',
        ]);

        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);

        $exhibition = Exhibition::create($data);

        return response()->json($exhibition, 201);
    }

    public function update(Request $request, Exhibition $exhibition): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'background'  => 'sometimes|nullable|string',
            'clippings'   => 'sometimes|nullable|array',
            'clippings.*.title'            => 'required|string|max:255',
            'clippings.*.screenshot_image' => 'nullable|string',
            'slug'        => 'sometimes|string|max:255|unique:exhibitions,slug,' . $exhibition->id,
            'sort_order'  => 'sometimes|integer',
        ]);

        $exhibition->update($data);

        return response()->json($exhibition->fresh());
    }

    public function destroy(Exhibition $exhibition): JsonResponse
    {
        $exhibition->delete();

        return response()->json(null, 204);
    }

    public function uploadCover(Request $request, Exhibition $exhibition): JsonResponse
    {
        $request->validate(['image' => 'required|image|max:30720']);

        $file     = $request->file('image');
        $filename = 'exhibition-' . $exhibition->id . '.webp';
        $dir      = storage_path('app/public/exhibitions');

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $mime   = $file->getMimeType();
        $source = match (true) {
            str_contains($mime, 'jpeg') => imagecreatefromjpeg($file->getRealPath()),
            str_contains($mime, 'png')  => imagecreatefrompng($file->getRealPath()),
            str_contains($mime, 'webp') => imagecreatefromwebp($file->getRealPath()),
            default                     => imagecreatefromjpeg($file->getRealPath()),
        };

        imagewebp($source, $dir . '/' . $filename, 85);
        imagedestroy($source);

        $exhibition->update(['cover_image' => '/storage/exhibitions/' . $filename]);

        return response()->json($exhibition->fresh());
    }

    public function uploadClippingScreenshot(Request $request, Exhibition $exhibition): JsonResponse
    {
        $request->validate(['image' => 'required|image|max:30720']);

        $file      = $request->file('image');
        $filename  = 'clipping-' . $exhibition->id . '-' . uniqid() . '.webp';
        $directory = storage_path('app/public/exhibitions/clippings');

        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $mimeType = $file->getMimeType();
        $source   = match (true) {
            str_contains($mimeType, 'jpeg') => imagecreatefromjpeg($file->getRealPath()),
            str_contains($mimeType, 'png')  => imagecreatefrompng($file->getRealPath()),
            str_contains($mimeType, 'webp') => imagecreatefromwebp($file->getRealPath()),
            default                         => imagecreatefromjpeg($file->getRealPath()),
        };

        imagewebp($source, $directory . '/' . $filename, 85);
        imagedestroy($source);

        return response()->json([
            'screenshot_image' => '/storage/exhibitions/clippings/' . $filename,
        ]);
    }

    public function syncArtworks(Request $request, Exhibition $exhibition): JsonResponse
    {
        $data = $request->validate([
            'artworks'              => 'required|array',
            'artworks.*.id'         => 'required|integer|exists:artworks,id',
            'artworks.*.sort_order' => 'integer',
        ]);

        $sync = collect($data['artworks'])->mapWithKeys(fn ($item) => [
            $item['id'] => ['sort_order' => $item['sort_order'] ?? 0],
        ])->toArray();

        $exhibition->artworks()->sync($sync);

        return response()->json(
            $exhibition->load(['artworks' => fn ($q) => $q->orderByPivot('sort_order')])
        );
    }
}
