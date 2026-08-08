/**
 * Section D — Material Properties (Phase 11c)
 *
 * প্লানের চাহিদা: "Concrete grade(s): f'c, Ec, unit weight; Steel
 * grade(s): fy, Es; Material summary টেবিল — কোথায় কোন গ্রেড
 * ব্যবহার হয়েছে (beam/column/slab/foundation)"।
 *
 * "কোথায় কোন গ্রেড ব্যবহার হয়েছে" — এর জন্য প্রতিটা material কে
 * ব্যবহারকারী element গুলোর সাথে ক্রস-রেফারেন্স করা হয়েছে
 * (element.materialId === material.materialId), category-wise
 * group করে। Ec না দেওয়া থাকলে (material.ts এর computeConcreteEc()
 * অনুযায়ী) ACI সূত্র থেকে হিসাব করে দেখানো হয় — raw undefined না।
 */

import { Text, StyleSheet } from "@react-pdf/renderer";
import { ReportPage } from "@/lib/documentation/pdf/components/ReportPage";
import { ReportTable } from "@/lib/documentation/pdf/components/ReportTable";
import { pdfFontSize, pdfSpacing } from "@/lib/documentation/pdf/theme";
import type { ReportContext } from "@/lib/documentation/reportContext";
import type { ConcreteMaterial, SteelMaterial } from "@/lib/types/material";
import { computeConcreteEc } from "@/lib/types/material";
import type { ElementCategory } from "@/lib/types/element";

export interface MaterialPropertiesProps {
  context: ReportContext;
}

const styles = StyleSheet.create({
  heading: {
    fontSize: pdfFontSize.h1,
    fontFamily: "Helvetica-Bold",
    marginBottom: pdfSpacing.sectionGap,
  },
  subheading: {
    fontSize: pdfFontSize.h2,
    fontFamily: "Helvetica-Bold",
    marginTop: pdfSpacing.sectionGap,
    marginBottom: 6,
  },
});

interface UsageRow {
  materialName: string;
  grade: string;
  usedIn: string;
}

function categoriesUsingMaterial(materialId: string, context: ReportContext): ElementCategory[] {
  const categories = new Set<ElementCategory>();
  for (const element of context.elements) {
    if (element.materialId === materialId) categories.add(element.category);
  }
  return Array.from(categories);
}

export function MaterialProperties({ context }: MaterialPropertiesProps) {
  const concreteMaterials = context.materials.materials.filter(
    (m): m is ConcreteMaterial => m.type === "concrete"
  );
  const steelMaterials = context.materials.materials.filter(
    (m): m is SteelMaterial => m.type === "steel"
  );

  const usageRows: UsageRow[] = context.materials.materials.map((m) => {
    const categories = categoriesUsingMaterial(m.materialId, context);
    const grade =
      m.type === "concrete"
        ? `f'c = ${(m as ConcreteMaterial).fc} MPa`
        : m.type === "steel"
          ? `fy = ${(m as SteelMaterial).fy} MPa`
          : "—";
    return {
      materialName: m.name,
      grade,
      usedIn: categories.length > 0 ? categories.join(", ") : "Not currently assigned",
    };
  });

  return (
    <ReportPage footerLabel="Structural Design Report — Section D: Material Properties">
      <Text style={styles.heading}>D. Material Properties</Text>

      <Text style={styles.subheading}>Concrete</Text>
      <ReportTable<ConcreteMaterial>
        columns={[
          { key: "name", header: "Material", flex: 2 },
          {
            key: "fc",
            header: "f'c (MPa)",
            flex: 1,
            align: "right",
            render: (row) => <Text>{row.fc}</Text>,
          },
          {
            key: "ec",
            header: "Ec (MPa)",
            flex: 1,
            align: "right",
            render: (row) => <Text>{Math.round(computeConcreteEc(row)).toLocaleString()}</Text>,
          },
          {
            key: "unitWeight",
            header: "Unit Weight (kN/m3)",
            flex: 1,
            align: "right",
            render: (row) => <Text>{row.unitWeight}</Text>,
          },
        ]}
        rows={concreteMaterials}
      />

      {steelMaterials.length > 0 && (
        <>
          <Text style={styles.subheading}>Steel</Text>
          <ReportTable<SteelMaterial>
            columns={[
              { key: "name", header: "Material", flex: 2 },
              { key: "fy", header: "fy (MPa)", flex: 1, align: "right" },
              { key: "fu", header: "fu (MPa)", flex: 1, align: "right" },
              { key: "es", header: "Es (MPa)", flex: 1, align: "right" },
            ]}
            rows={steelMaterials}
          />
        </>
      )}

      <Text style={styles.subheading}>Material Usage Summary</Text>
      <ReportTable<UsageRow>
        columns={[
          { key: "materialName", header: "Material", flex: 2 },
          { key: "grade", header: "Grade", flex: 1 },
          { key: "usedIn", header: "Used In (Element Category)", flex: 2 },
        ]}
        rows={usageRows}
      />
    </ReportPage>
  );
}
