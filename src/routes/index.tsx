import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from '@/pages/Home'
import About from '@/pages/About'
import { DynamicFormExamples } from '@/pages/DynamicFormExamples'
import { VirtualScrollExample } from '@/pages/examples/VirtualScrollExample'
import { MemoPerformanceTest } from '@/pages/examples/PerformanceTest/MemoPerformanceTest'
import { AsyncSchemaLinkageExample } from '@/pages/examples/NestedForm/AsyncSchemaLinkageExample'
import { ErrorScrollExample } from '@/pages/examples/ErrorScrollExample'
import { RefreshLinkageExample } from '@/pages/examples/RefreshLinkageExample'
import { KeyValueArrayExample } from '@/pages/examples/KeyValueArrayExample'
import { TableArrayExample } from '@/pages/examples/TableArrayExample'
import { MultipleLinkagesExample } from '@/pages/examples/MultipleLinkagesExample'
import { SchemaBuilderExample } from '@/pages/examples/SchemaBuilderExample'
import { SchemaDefaultsExample } from '@/pages/examples/SchemaDefaultsExample'
import { SetValuesNestedExample } from '@/pages/examples/SetValuesNestedExample'
import { RaceConditionExample } from '@/pages/examples/RaceConditionExample'

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/dynamic-form" element={<DynamicFormExamples />} />
        <Route path="/virtual-scroll" element={<VirtualScrollExample />} />
        <Route path="/memo-performance" element={<MemoPerformanceTest />} />
        <Route
          path="/async-schema-linkage"
          element={<AsyncSchemaLinkageExample />}
        />
        <Route path="/error-scroll" element={<ErrorScrollExample />} />
        <Route path="/refresh-linkage" element={<RefreshLinkageExample />} />
        <Route path="/key-value-array" element={<KeyValueArrayExample />} />
        <Route path="/table-array" element={<TableArrayExample />} />
        <Route
          path="/multiple-linkages"
          element={<MultipleLinkagesExample />}
        />
        <Route path="/schema-builder" element={<SchemaBuilderExample />} />
        <Route path="/schema-defaults" element={<SchemaDefaultsExample />} />
        <Route path="/set-values-nested" element={<SetValuesNestedExample />} />
        <Route path="/race-condition" element={<RaceConditionExample />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter
