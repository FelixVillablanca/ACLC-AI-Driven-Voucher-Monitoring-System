<?php

namespace App\Console\Commands;

use App\Domain\Identity\Actions\CreateSuperAdmin;
use App\Domain\Identity\Support\RoleEmailDomains;
use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * php artisan superadmin:create
 *
 * The ONLY way to make a Super Admin (spec §4.2): it needs access to the server itself.
 * It asks for the name and the email name, then either takes your password or generates one.
 *
 * Non-interactive (scripts / tests):
 *   php artisan superadmin:create --first-name=Felix --last-name=Bianito --username=felixbianito --generate-password
 */
class CreateSuperAdminCommand extends Command
{
    protected $signature = 'superadmin:create
        {--first-name= : First name}
        {--last-name= : Last name}
        {--username= : The part before @Superadmin.com}
        {--password= : At least 12 characters with letters and numbers (avoid: it stays in your shell history)}
        {--generate-password : Generate a strong password and show it once}';

    protected $description = 'Create a Super Admin account ({name}@Superadmin.com). Max 3 active Super Admins.';

    public function handle(CreateSuperAdmin $create): int
    {
        $firstName = trim((string) ($this->option('first-name') ?? $this->ask('First name')));
        $lastName = trim((string) ($this->option('last-name') ?? $this->ask('Last name')));
        $username = strtolower(trim((string) ($this->option('username') ?? $this->ask('Email name (the part before @Superadmin.com)'))));

        $generated = $this->option('generate-password');
        $password = $generated
            ? $this->generatePassword()
            : (string) ($this->option('password') ?? $this->secret('Password (12+ characters, letters and numbers)'));

        $validator = Validator::make(
            ['first_name' => $firstName, 'last_name' => $lastName, 'username' => $username, 'password' => $password],
            [
                'first_name' => ['required', 'max:100'],
                'last_name' => ['required', 'max:100'],
                'username' => ['required', 'max:64', 'regex:'.RoleEmailDomains::USERNAME_PATTERN],
                'password' => ['required', 'min:12', 'max:64', 'regex:/[A-Za-z]/', 'regex:/[0-9]/'],
            ],
            ['password.regex' => 'The password must contain both letters and numbers.'],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $email = RoleEmailDomains::emailFor($username, 'super_admin');
        if (User::where('email', $email)->exists()) {
            $this->error("A user with the email {$email} already exists.");

            return self::FAILURE;
        }

        try {
            $user = $create->handle($firstName, $lastName, $username, $password);
        } catch (ApiException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Super Admin created: {$user->full_name} <{$user->email}> ({$user->employee_id})");
        if ($generated) {
            $this->warn("Password (shown only once, copy it now): {$password}");
        }
        $this->line('They sign in at /login and land on /superadmin.');

        return self::SUCCESS;
    }

    /** 16 characters, always with letters AND numbers (same rule as the Create user form). */
    private function generatePassword(): string
    {
        do {
            $password = Str::password(16, symbols: false);
        } while (! preg_match('/[A-Za-z]/', $password) || ! preg_match('/[0-9]/', $password));

        return $password;
    }
}
