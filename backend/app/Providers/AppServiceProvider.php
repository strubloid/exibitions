<?php

namespace App\Providers;

use App\Contracts\PaymentGateway;
use App\Services\OrderService;
use App\Services\PricingService;
use App\Services\StripeGateway;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // SOLID DIP: depend on the contract, swap the implementation here.
        $this->app->bind(PaymentGateway::class, StripeGateway::class);

        // Services are singletons for this app size.
        $this->app->singleton(PricingService::class);
        $this->app->singleton(OrderService::class);
    }

    public function boot(): void
    {
    }
}