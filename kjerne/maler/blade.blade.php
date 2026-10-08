{{-- Blade. Skrivefeilen med vilje er <fs-feild>. --}}
<form action="{{ route('soknad.send') }}" method="post" novalidate>
  @csrf
  <fs-field @if($errors->has('epost')) invalid @endif>
    <label class="fs-label" data-required="text">E-postadresse</label>
    <input class="fs-input" type="email" name="epost" value="{{ old('epost') }}" @class(['feil' => $errors->has('epost')])>
    @error('epost')
      <p class="fs-error-text">{{ $message }}</p>
    @enderror
  </fs-field>
  <fs-feild></fs-feild>
  <button class="fs-button" data-variant="{{ $utkast ? 'secondary' : '' }}" type="submit">Send</button>
</form>
