import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';

/**
 * OpenTelemetry SDK configuration for Railway serverless deployments.
 *
 * This file must be imported BEFORE any NestJS modules are loaded so that
 * auto-instrumentation can patch modules (HTTP, Express, Prisma) before they are required.
 *
 * Telemetry is disabled by default when OTEL_EXPORTER_OTLP_ENDPOINT is not set,
 * making it safe for local development without a collector.
 */

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (otlpEndpoint) {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || process.env.RAILWAY_SERVICE_NAME || 'business-engine',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  });

  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy filesystem instrumentation
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();

  // Graceful shutdown for Railway serverless cold-starts / SIGTERM
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('OpenTelemetry SDK terminated'))
      .catch((error) => console.error('Error terminating OpenTelemetry SDK', error))
      .finally(() => process.exit(0));
  });
} else {
  // Telemetry disabled - local dev mode
  console.log('OpenTelemetry disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
}
