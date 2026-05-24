import React from 'react'
import { Link } from 'react-router-dom'
import '@/styles/pages/Home.scss'

interface ExampleItem {
  path: string
  title: string
  description: string
  category: 'workflow' | 'form' | 'performance' | 'other'
}

const examples: ExampleItem[] = [
  {
    path: '/dynamic-form',
    title: 'Dynamic Form Examples',
    description: 'Comprehensive dynamic form examples with JSON Schema',
    category: 'form',
  },
  {
    path: '/schema-builder',
    title: 'Schema Builder',
    description: 'Visual editor for ExtendedJSONSchema with integrated preview',
    category: 'form',
  },
  {
    path: '/error-scroll',
    title: 'Error Scroll Example',
    description: 'Auto-scroll to first error field on validation',
    category: 'form',
  },
  {
    path: '/refresh-linkage',
    title: 'Refresh Linkage Example',
    description: 'Manual trigger for field linkage initialization',
    category: 'form',
  },
  {
    path: '/key-value-array',
    title: 'Key-Value Array Example',
    description: 'Dynamic key-value pair array field',
    category: 'form',
  },
  {
    path: '/table-array',
    title: 'Table Array Example',
    description: 'Array field with table layout',
    category: 'form',
  },
  {
    path: '/multiple-linkages',
    title: 'Multiple Linkages Example',
    description: 'Multiple linkage rules for a single field',
    category: 'form',
  },
  {
    path: '/race-condition',
    title: 'Race Condition Example',
    description: '复现初始化与字段变化联动之间的竞态条件问题',
    category: 'form',
  },
  {
    path: '/async-schema-linkage',
    title: 'Async Schema Linkage',
    description: 'Asynchronous schema loading with linkage',
    category: 'form',
  },
  {
    path: '/schema-defaults',
    title: 'Schema Defaults Example',
    description: 'Schema default values with linkage integration',
    category: 'form',
  },
  {
    path: '/virtual-scroll',
    title: 'Virtual Scroll Example',
    description: 'Virtual scrolling for large lists',
    category: 'performance',
  },
  {
    path: '/memo-performance',
    title: 'Memo Performance Test',
    description: 'React.memo performance optimization test',
    category: 'performance',
  },
]

const Home = () => {
  const categories = {
    workflow: 'Workflow Examples',
    form: 'Dynamic Form Examples',
    performance: 'Performance Examples',
    other: 'Other Examples',
  }

  const groupedExamples = examples.reduce(
    (acc, example) => {
      if (!acc[example.category]) {
        acc[example.category] = []
      }
      acc[example.category].push(example)
      return acc
    },
    {} as Record<string, ExampleItem[]>
  )

  return (
    <div className="home-page">
      <div className="home-header">
        <h1>Example Gallery</h1>
        <p>
          Explore various examples of dynamic forms and performance
          optimizations
        </p>
      </div>

      <div className="examples-container">
        {Object.entries(groupedExamples).map(([category, items]) => (
          <div key={category} className="example-category">
            <h2 className="category-title">
              {categories[category as keyof typeof categories]}
            </h2>
            <div className="example-grid">
              {items.map((example) => (
                <Link
                  key={example.path}
                  to={example.path}
                  className="example-card"
                >
                  <h3 className="example-title">{example.title}</h3>
                  <p className="example-description">{example.description}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Home
