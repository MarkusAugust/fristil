/**
 * Inngangen til bunten JVM-biblioteket kjører.
 *
 * QuickJS kjører fila som et skript, ikke som en modul, så funksjonene legges
 * på `globalThis` der Kotlin-siden finner dem.
 */
import {
  diagnoseMarkup,
  diagnosePage,
} from "../../designsystem/src/diagnostics/index.js"

Object.assign(globalThis, {
  FristilDiagnostikk: { diagnoseMarkup, diagnosePage },
})
