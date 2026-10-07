package no.fristil.cli;

import com.dylibso.chicory.runtime.CompiledModule;
import com.dylibso.chicory.runtime.Instance;
import com.dylibso.chicory.runtime.Machine;
import com.dylibso.chicory.wasm.WasmModule;
import java.io.IOException;
import java.io.UncheckedIOException;
import com.dylibso.chicory.wasm.Parser;
import java.io.InputStream;
import java.util.function.Function;

public final class FristilCli implements CompiledModule {

    public FristilCli() {
    }

    public static Machine create(Instance instance) {
        return new no.fristil.cli.FristilCliMachine(instance);
    }

    private static class WasmModuleHolder {

        static final WasmModule INSTANCE;

        static {
            try (InputStream in = FristilCli.class.getResourceAsStream("FristilCli.meta")) {
                INSTANCE = Parser.parse(in);
            } catch (IOException e) {
                throw new UncheckedIOException("Failed to load .meta WASM module", e);
            }
        }
    }

    public static WasmModule load() {
        return WasmModuleHolder.INSTANCE;
    }

    public Function<Instance, Machine> machineFactory() {
        return FristilCli::create;
    }

    public WasmModule wasmModule() {
        return FristilCli.load();
    }
}
