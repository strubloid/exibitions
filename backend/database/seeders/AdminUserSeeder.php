<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@exibitions.com')],
            [
                'name'     => 'Admin',
                'password' => Hash::make(env('ADMIN_PASSWORD', 'secret')),
                'is_admin' => true,
            ]
        );
    }
}
