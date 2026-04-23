'use client';

import { useExpenseWorkbook } from '../expense/hooks/useExpenseWorkbook';
import { useItemForm } from '../expense/hooks/useItemForm';
import { useReceiptParser } from '../expense/hooks/useReceiptParser';
import { useExcelPreview } from '../expense/hooks/useExcelPreview';
import { AutoLoading } from '../expense/components/AutoLoading';
import { ExcelUploadCard } from '../expense/components/ExcelUploadCard';
import { ReceiptUploadCard } from '../expense/components/ReceiptUploadCard';
import { ItemFormCard } from '../expense/components/ItemFormCard';
import { ItemListCard } from '../expense/components/ItemListCard';
import { SaveButton } from '../expense/components/SaveButton';
import { PreviewPanel } from '../expense/components/PreviewPanel';
import { cardStyle } from '../expense/styles';

interface Props {
  currentManager: string;
  isAdmin: boolean;
  department?: string;
}

export default function ExpenseTab({ currentManager, department }: Props) {
  const wb = useExpenseWorkbook({ currentManager, department });
  const form = useItemForm({
    onItemAdded: () => wb.setSaveStatus('unsaved'),
  });
  const receipt = useReceiptParser({
    currentManager,
    onParsed: form.applyParseResult,
  });
  const preview = useExcelPreview({
    setUnsaved: () => wb.setSaveStatus('unsaved'),
  });

  return (
    <div>
      {wb.autoLoading && <AutoLoading />}

      {!wb.autoLoading && (
        <ExcelUploadCard
          saveStatus={wb.saveStatus}
          hasWorkbook={!!wb.workbook}
          excelLoading={wb.excelLoading}
          sheetNames={wb.sheetNames}
          selectedSheet={wb.selectedSheet}
          setSelectedSheet={wb.setSelectedSheet}
          onExcelUpload={wb.handleExcelUpload}
          onOpenPreview={() => wb.workbook && preview.openPreview(wb.workbook, wb.selectedSheet)}
          onDownload={() => wb.download(form.items, form.clearItems)}
        />
      )}

      {wb.workbook && (
        <ReceiptUploadCard
          receiptPreview={receipt.receiptPreview}
          parsing={receipt.parsing}
          receiptInputRef={form.receiptInputRef}
          onReceiptUpload={receipt.handleReceiptUpload}
        />
      )}

      {wb.workbook && (form.parseResult || form.editDate) && !receipt.parsing && (
        <ItemFormCard form={form} />
      )}

      {wb.workbook && !form.parseResult && !form.editDate && !receipt.parsing && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <button
            onClick={form.startManualEntry}
            style={{
              padding: '12px 24px', borderRadius: 10,
              border: '1.5px solid rgba(90,21,21,0.15)', background: 'transparent',
              fontSize: 13, fontWeight: 600, color: '#5A1515', cursor: 'pointer',
            }}
          >
            영수증 없이 직접 입력
          </button>
        </div>
      )}

      <ItemListCard items={form.items} onRemove={form.removeItem} />

      {wb.workbook && (
        <SaveButton
          saveStatus={wb.saveStatus}
          itemsCount={form.items.length}
          onSave={() => wb.save(form.items, form.clearItems)}
        />
      )}

      <PreviewPanel
        open={preview.previewOpen}
        onClose={() => preview.setPreviewOpen(false)}
        selectedSheet={wb.selectedSheet}
        previewRows={preview.previewRows}
        vehicleInfo={preview.vehicleInfo}
        onDeleteRow={(rowNum) =>
          preview.handleDeletePreviewRow(wb.workbook, wb.selectedSheet, rowNum)
        }
      />
    </div>
  );
}
