<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Initiated = 'initiated';
    case Succeeded = 'succeeded';
    case Failed    = 'failed';
}