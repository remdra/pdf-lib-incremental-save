import { PDFObject, PDFRef } from 'src/core';

export interface DocumentSnapshot {
  pdfSize: number;
  prevStartXRef: number;

  shouldSave: (objectNumber: number) => boolean;

  markRefForSave: (ref: PDFRef) => void;
  markRefsForSave: (refs: PDFRef[]) => void;

  markObjForSave: (obj: PDFObject) => void;
  markObjsForSave: (objs: PDFObject[]) => void;
}
