/**
 * 独立联动示例
 *
 * 演示场景：
 * - 外部 DynamicForm 有自己的联动配置（部门选择影响显示字段）
 * - 自定义组件内部的 DynamicForm 有独立的联动配置（职位选择影响薪资显示）
 * - 两者联动完全隔离，互不影响
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Card, H3, Callout } from "@blueprintjs/core";
import { DynamicForm } from "../../components/DynamicForm";
import type {
  DynamicFormRef,
  ExtendedJSONSchema,
  FieldWidgetProps,
} from "../../components/DynamicForm";

const innerSchema: ExtendedJSONSchema = {
  type: "object",
  title: "Employee Information",
  properties: {
    position: {
      type: "string",
      title: "Position",
      enum: ["Junior", "Senior", "Manager", "Director"],
      ui: {
        placeholder: "Select position",
      },
    },
    salaryRange: {
      type: "string",
      title: "Salary Range",
      ui: {
        placeholder: "Enter salary range",
        linkages: [
          {
            type: "visibility",
            dependencies: ["#/properties/position"],
            when: {
              field: "#/properties/position",
              operator: "in",
              value: ["Manager", "Director"],
            },
            fulfill: {
              state: { visible: true },
            },
            otherwise: {
              state: { visible: false },
            },
          },
        ],
      },
    },
    yearsExperience: {
      type: "integer",
      title: "Years of Experience",
      minimum: 0,
      ui: {
        placeholder: "Enter years",
      },
    },
    hasTeam: {
      type: "boolean",
      title: "Manages a Team",
      ui: {
        linkages: [
          {
            type: "visibility",
            dependencies: ["#/properties/position"],
            when: {
              field: "#/properties/position",
              operator: "in",
              value: ["Manager", "Director"],
            },
            fulfill: {
              state: { visible: true },
            },
            otherwise: {
              state: { visible: false },
            },
          },
        ],
      },
    },
  },
};

const outerSchema: ExtendedJSONSchema = {
  type: "object",
  title: "Department Form",
  properties: {
    department: {
      type: "string",
      title: "Department",
      enum: ["Engineering", "Sales", "HR", "Finance"],
      ui: {
        placeholder: "Select department",
      },
    },
    location: {
      type: "string",
      title: "Office Location",
      ui: {
        placeholder: "Enter location",
        linkages: [
          {
            type: "visibility",
            dependencies: ["#/properties/department"],
            when: {
              field: "#/properties/department",
              operator: "in",
              value: ["Engineering", "Sales"],
            },
            fulfill: {
              state: { visible: true },
            },
            otherwise: {
              state: { visible: false },
            },
          },
        ],
      },
    },
    budget: {
      type: "number",
      title: "Department Budget",
      ui: {
        placeholder: "Enter budget",
        linkages: [
          {
            type: "visibility",
            dependencies: ["#/properties/department"],
            when: {
              field: "#/properties/department",
              operator: "==",
              value: "Finance",
            },
            fulfill: {
              state: { visible: true },
            },
            otherwise: {
              state: { visible: false },
            },
          },
        ],
      },
    },
    employeeInfo: {
      type: "object",
      title: "Employee Details",
      ui: {
        widget: "custom",
      },
    },
  },
};

// ============ 自定义组件：包含独立 DynamicForm ============

/**
 * 员工信息组件 - 内部有独立的 DynamicForm
 */
const EmployeeInfoWidget = forwardRef<HTMLDivElement, FieldWidgetProps>(
  ({ value, onChange }, ref) => {
    const innerFormRef = useRef<DynamicFormRef>(null);

    useEffect(() => {
      void innerFormRef.current?.refreshLinkage();
    }, []);

    const handleInnerChange = useCallback(
      (data: Record<string, any>) => {
        onChange?.(data);
      },
      [onChange],
    );

    return (
      <div ref={ref}>
        <Card style={{ marginTop: 10, backgroundColor: "#f5f8fa" }}>
          <H3 style={{ fontSize: 16, marginBottom: 15 }}>
            Internal DynamicForm (Independent Linkage)
          </H3>

          <DynamicForm
            ref={innerFormRef}
            schema={innerSchema}
            defaultValues={value || {}}
            onChange={handleInnerChange}
            renderAsForm={false}
            showSubmitButton={false}
            // 关键：不设置 asNestedForm，保持联动隔离（这是默认行为）
          />
        </Card>
      </div>
    );
  },
);

EmployeeInfoWidget.displayName = "EmployeeInfoWidget";

// ============ 主示例组件 ============

export const IndependentLinkageExample: React.FC = () => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const outerFormRef = useRef<DynamicFormRef>(null);

  useEffect(() => {
    void outerFormRef.current?.refreshLinkage();
  }, []);

  const handleChange = useCallback((data: Record<string, any>) => {
    setFormData(data);
  }, []);

  const widgets = useMemo(
    () => ({
      custom: EmployeeInfoWidget,
    }),
    [],
  );

  return (
    <div style={{ padding: 40, maxWidth: 900 }}>
      <H3>Independent Linkage in Nested DynamicForm</H3>

      <Callout intent="primary" style={{ marginBottom: 20 }}>
        <strong>Scenario:</strong>
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li>
            <strong>Outer Form:</strong> Department selection controls which
            fields are visible (Location for Engineering/Sales, Budget for
            Finance)
          </li>
          <li>
            <strong>Inner Form (gray box):</strong> Position selection
            independently controls salary range and team management fields
          </li>
          <li>
            <strong>Key Point:</strong> The two forms have completely isolated
            linkage states. Changing fields in one form does NOT affect the
            other.
          </li>
        </ul>
      </Callout>

      <DynamicForm
        ref={outerFormRef}
        schema={outerSchema}
        defaultValues={formData}
        onChange={handleChange}
        widgets={widgets}
        renderAsForm={false}
        showSubmitButton={false}
      />

      <Card style={{ marginTop: 30 }}>
        <H3 style={{ fontSize: 16 }}>Form Data</H3>
        <pre
          style={{
            fontSize: 12,
            backgroundColor: "#f5f8fa",
            padding: 10,
            borderRadius: 4,
          }}
        >
          {JSON.stringify(formData, null, 2)}
        </pre>
      </Card>

      <Callout intent="success" style={{ marginTop: 20 }}>
        <strong>Implementation:</strong>
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li>
            The inner DynamicForm does <strong>NOT</strong> set{" "}
            <code>asNestedForm</code> property
          </li>
          <li>
            Default behavior (<code>asNestedForm: false</code>) creates
            independent linkage state
          </li>
          <li>
            Each form has its own <code>LinkageStateProvider</code>
          </li>
          <li>No special configuration needed - isolation is automatic!</li>
        </ul>
      </Callout>
    </div>
  );
};
