import {
  DefaultDocumentSnapshot,
  defaultDocumentSnapshot,
  DocumentSnapshot,
} from 'src/api';
import PDFCrossRefSection from 'src/core/document/PDFCrossRefSection';
import PDFHeader from 'src/core/document/PDFHeader';
import PDFTrailer from 'src/core/document/PDFTrailer';
import PDFTrailerDict from 'src/core/document/PDFTrailerDict';
import PDFDict from 'src/core/objects/PDFDict';
import PDFObject from 'src/core/objects/PDFObject';
import PDFRef from 'src/core/objects/PDFRef';
import PDFContext from 'src/core/PDFContext';
import PDFObjectStream from 'src/core/structures/PDFObjectStream';
import CharCodes from 'src/core/syntax/CharCodes';
import { copyStringIntoBuffer, waitForTick } from 'src/utils';
import PDFNumber from '../objects/PDFNumber';

export interface SerializationInfo {
  size: number;
  header: PDFHeader;
  indirectObjects: [PDFRef, PDFObject][];
  xref?: PDFCrossRefSection;
  trailerDict?: PDFTrailerDict;
  trailer: PDFTrailer;
}

class PDFWriter {
  static forContext = (context: PDFContext, objectsPerTick: number) =>
    new PDFWriter(context, objectsPerTick, defaultDocumentSnapshot);

  static forContextWithSnapshot = (
    context: PDFContext,
    objectsPerTick: number,
    snapshot: DocumentSnapshot,
  ) => new PDFWriter(context, objectsPerTick, snapshot);

  protected readonly context: PDFContext;

  protected readonly objectsPerTick: number;
  protected readonly snapshot: DocumentSnapshot;
  private parsedObjects = 0;

  protected constructor(
    context: PDFContext,
    objectsPerTick: number,
    snapshot: DocumentSnapshot,
  ) {
    this.context = context;
    this.objectsPerTick = objectsPerTick;
    this.snapshot = snapshot;
  }

  async serializeToBuffer(): Promise<Uint8Array> {
    const incremental = !(this.snapshot instanceof DefaultDocumentSnapshot);
    const {
      size,
      header,
      indirectObjects,
      xref,
      trailerDict,
      trailer,
    } = await this.computeBufferSize(incremental);

    let offset = 0;
    const buffer = new Uint8Array(size);

    if (!incremental) {
      offset += header.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
    }
    buffer[offset++] = CharCodes.Newline;

    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const [ref, object] = indirectObjects[idx];

      if (!this.snapshot.shouldSave(ref.objectNumber)) {
        continue;
      }

      const objectNumber = String(ref.objectNumber);
      offset += copyStringIntoBuffer(objectNumber, buffer, offset);
      buffer[offset++] = CharCodes.Space;

      const generationNumber = String(ref.generationNumber);
      offset += copyStringIntoBuffer(generationNumber, buffer, offset);
      buffer[offset++] = CharCodes.Space;

      buffer[offset++] = CharCodes.o;
      buffer[offset++] = CharCodes.b;
      buffer[offset++] = CharCodes.j;
      buffer[offset++] = CharCodes.Newline;

      offset += object.copyBytesInto(buffer, offset);

      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.e;
      buffer[offset++] = CharCodes.n;
      buffer[offset++] = CharCodes.d;
      buffer[offset++] = CharCodes.o;
      buffer[offset++] = CharCodes.b;
      buffer[offset++] = CharCodes.j;
      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.Newline;

      const n =
        object instanceof PDFObjectStream ? object.getObjectsCount() : 1;
      if (this.shouldWaitForTick(n)) await waitForTick();
    }

    if (xref) {
      offset += xref.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
    }

    if (trailerDict) {
      offset += trailerDict.copyBytesInto(buffer, offset);
      buffer[offset++] = CharCodes.Newline;
      buffer[offset++] = CharCodes.Newline;
    }

    offset += trailer.copyBytesInto(buffer, offset);

    return buffer;
  }

  protected computeIndirectObjectSize([ref, object]: [
    PDFRef,
    PDFObject,
  ]): number {
    const refSize = ref.sizeInBytes() + 3; // 'R' -> 'obj\n'
    const objectSize = object.sizeInBytes() + 9; // '\nendobj\n\n'
    return refSize + objectSize;
  }

  protected createTrailerDict(prevStartXRef?: number): PDFDict {
    return this.context.obj({
      Size: this.context.largestObjectNumber + 1,
      Root: this.context.trailerInfo.Root,
      Encrypt: this.context.trailerInfo.Encrypt,
      Info: this.context.trailerInfo.Info,
      ID: this.context.trailerInfo.ID,
      Prev: prevStartXRef ? PDFNumber.of(prevStartXRef) : undefined,
    });
  }

  protected async computeBufferSize(
    incremental: boolean,
  ): Promise<SerializationInfo> {
    const header = PDFHeader.forVersion(1, 7);

    let size = this.snapshot.pdfSize;
    if (!incremental) {
      size += header.sizeInBytes() + 1;
    }
    size += 1;

    const xref = PDFCrossRefSection.create();

    const indirectObjects = this.context.enumerateIndirectObjects();

    for (let idx = 0, len = indirectObjects.length; idx < len; idx++) {
      const indirectObject = indirectObjects[idx];
      const [ref] = indirectObject;
      if (!this.snapshot.shouldSave(ref.objectNumber)) {
        continue;
      }
      xref.addEntry(ref, size);
      size += this.computeIndirectObjectSize(indirectObject);
      if (this.shouldWaitForTick(1)) await waitForTick();
    }

    const xrefOffset = size;
    size += xref.sizeInBytes() + 1; // '\n'

    const trailerDict = PDFTrailerDict.of(
      this.createTrailerDict(this.snapshot.prevStartXRef),
    );
    size += trailerDict.sizeInBytes() + 2; // '\n\n'

    const trailer = PDFTrailer.forLastCrossRefSectionOffset(xrefOffset);
    size += trailer.sizeInBytes();
    size -= this.snapshot.pdfSize;

    return { size, header, indirectObjects, xref, trailerDict, trailer };
  }

  protected shouldWaitForTick = (n: number) => {
    this.parsedObjects += n;
    return this.parsedObjects % this.objectsPerTick === 0;
  };
}

export default PDFWriter;
