import { CollectionService } from "@rbxts/services";
import Utils from "../Utils";

const ChangeHistoryService = game.GetService("ChangeHistoryService");
const Selection = game.GetService("Selection");

const { getInstancePath, getInstanceByPath } = Utils;

function serializeValue(value: unknown): unknown {
	const vType = typeOf(value);
	if (vType === "Vector3") {
		const v = value as Vector3;
		return { X: v.X, Y: v.Y, Z: v.Z, _type: "Vector3" };
	} else if (vType === "Color3") {
		const v = value as Color3;
		return { R: v.R, G: v.G, B: v.B, _type: "Color3" };
	} else if (vType === "CFrame") {
		const v = value as CFrame;
		return { Position: { X: v.Position.X, Y: v.Position.Y, Z: v.Position.Z }, _type: "CFrame" };
	} else if (vType === "UDim2") {
		const v = value as UDim2;
		return {
			X: { Scale: v.X.Scale, Offset: v.X.Offset },
			Y: { Scale: v.Y.Scale, Offset: v.Y.Offset },
			_type: "UDim2",
		};
	} else if (vType === "BrickColor") {
		const v = value as BrickColor;
		return { Name: v.Name, _type: "BrickColor" };
	}
	return value;
}

function deserializeValue(attributeValue: unknown, valueType?: string): unknown {
	if (!typeIs(attributeValue, "table")) return attributeValue;

	const tbl = attributeValue as Record<string, unknown>;
	const t = (tbl._type as string) ?? valueType;

	if (t === "Vector3") {
		return new Vector3((tbl.X as number) ?? 0, (tbl.Y as number) ?? 0, (tbl.Z as number) ?? 0);
	} else if (t === "Color3") {
		return new Color3((tbl.R as number) ?? 0, (tbl.G as number) ?? 0, (tbl.B as number) ?? 0);
	} else if (t === "UDim2") {
		const x = tbl.X as Record<string, number> | undefined;
		const y = tbl.Y as Record<string, number> | undefined;
		return new UDim2(x?.Scale ?? 0, x?.Offset ?? 0, y?.Scale ?? 0, y?.Offset ?? 0);
	} else if (t === "BrickColor") {
		return new BrickColor(((tbl.Name as string) ?? "Medium stone grey") as unknown as number);
	}
	return attributeValue;
}

function getAttribute(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	const attributeName = requestData.attributeName as string;

	if (!instancePath || !attributeName) {
		return { error: "Instance path and attribute name are required" };
	}

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const [success, result] = pcall(() => {
		const value = instance.GetAttribute(attributeName);
		return {
			instancePath,
			attributeName,
			value: serializeValue(value),
			valueType: typeOf(value),
			exists: value !== undefined,
		};
	});

	if (success) return result;
	return { error: `Failed to get attribute: ${result}` };
}

function setAttribute(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	const attributeName = requestData.attributeName as string;
	const attributeValue = requestData.attributeValue;
	const valueType = requestData.valueType as string | undefined;

	if (!instancePath || !attributeName) {
		return { error: "Instance path and attribute name are required" };
	}

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const [success, result] = pcall(() => {
		const value = deserializeValue(attributeValue, valueType);
		instance.SetAttribute(attributeName, value as AttributeValue);
		ChangeHistoryService.SetWaypoint(`Set attribute ${attributeName} on ${instance.Name}`);

		return {
			success: true, instancePath, attributeName,
			value: attributeValue, message: "Attribute set successfully",
		};
	});

	if (success) return result;
	return { error: `Failed to set attribute: ${result}` };
}

function getAttributes(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	if (!instancePath) return { error: "Instance path is required" };

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const [success, result] = pcall(() => {
		const attributes = instance.GetAttributes();
		const serializedAttributes: Record<string, { value: unknown; type: string }> = {};
		let count = 0;

		for (const [name, value] of pairs(attributes)) {
			serializedAttributes[name as string] = {
				value: serializeValue(value),
				type: typeOf(value),
			};
			count++;
		}

		return { instancePath, attributes: serializedAttributes, count };
	});

	if (success) return result;
	return { error: `Failed to get attributes: ${result}` };
}

function deleteAttribute(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	const attributeName = requestData.attributeName as string;

	if (!instancePath || !attributeName) {
		return { error: "Instance path and attribute name are required" };
	}

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const [success, result] = pcall(() => {
		const existed = instance.GetAttribute(attributeName) !== undefined;
		instance.SetAttribute(attributeName, undefined);
		ChangeHistoryService.SetWaypoint(`Delete attribute ${attributeName} from ${instance.Name}`);

		return {
			success: true, instancePath, attributeName, existed,
			message: existed ? "Attribute deleted successfully" : "Attribute did not exist",
		};
	});

	if (success) return result;
	return { error: `Failed to delete attribute: ${result}` };
}

function getTags(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	if (!instancePath) return { error: "Instance path is required" };

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const [success, result] = pcall(() => {
		const tags = CollectionService.GetTags(instance);
		return { instancePath, tags, count: tags.size() };
	});

	if (success) return result;
	return { error: `Failed to get tags: ${result}` };
}

function addTag(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	const tagName = requestData.tagName as string;

	if (!instancePath || !tagName) {
		return { error: "Instance path and tag name are required" };
	}

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const [success, result] = pcall(() => {
		const alreadyHad = CollectionService.HasTag(instance, tagName);
		CollectionService.AddTag(instance, tagName);
		ChangeHistoryService.SetWaypoint(`Add tag ${tagName} to ${instance.Name}`);

		return {
			success: true, instancePath, tagName, alreadyHad,
			message: alreadyHad ? "Instance already had this tag" : "Tag added successfully",
		};
	});

	if (success) return result;
	return { error: `Failed to add tag: ${result}` };
}

function removeTag(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	const tagName = requestData.tagName as string;

	if (!instancePath || !tagName) {
		return { error: "Instance path and tag name are required" };
	}

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const [success, result] = pcall(() => {
		const hadTag = CollectionService.HasTag(instance, tagName);
		CollectionService.RemoveTag(instance, tagName);
		ChangeHistoryService.SetWaypoint(`Remove tag ${tagName} from ${instance.Name}`);

		return {
			success: true, instancePath, tagName, hadTag,
			message: hadTag ? "Tag removed successfully" : "Instance did not have this tag",
		};
	});

	if (success) return result;
	return { error: `Failed to remove tag: ${result}` };
}

function getTagged(requestData: Record<string, unknown>) {
	const tagName = requestData.tagName as string;
	if (!tagName) return { error: "Tag name is required" };

	const [success, result] = pcall(() => {
		const taggedInstances = CollectionService.GetTagged(tagName);
		const instances = taggedInstances.map((instance) => ({
			name: instance.Name,
			className: instance.ClassName,
			path: getInstancePath(instance),
		}));

		return { tagName, instances, count: instances.size() };
	});

	if (success) return result;
	return { error: `Failed to get tagged instances: ${result}` };
}

function getSelection(_requestData: Record<string, unknown>) {
	const selection = Selection.Get();

	if (selection.size() === 0) {
		return { success: true, selection: [], count: 0, message: "No objects selected" };
	}

	const selectedObjects = selection.map((instance: Instance) => ({
		name: instance.Name,
		className: instance.ClassName,
		path: getInstancePath(instance),
		parent: instance.Parent ? getInstancePath(instance.Parent) : undefined,
	}));

	return {
		success: true,
		selection: selectedObjects,
		count: selection.size(),
		message: `${selection.size()} object(s) selected`,
	};
}

function executeLuau(requestData: Record<string, unknown>) {
	const code = requestData.code as string;
	if (!code || code === "") return { error: "Code is required" };

	const output: string[] = [];
	const oldPrint = print;
	const oldWarn = warn;

	const env = getfenv(0) as unknown as Record<string, unknown>;
	env["print"] = (...args: defined[]) => {
		const parts: string[] = [];
		for (const a of args) parts.push(tostring(a));
		output.push(parts.join("\t"));
		oldPrint(...(args as [defined, ...defined[]]));
	};
	env["warn"] = (...args: defined[]) => {
		const parts: string[] = [];
		for (const a of args) parts.push(tostring(a));
		output.push(`[warn] ${parts.join("\t")}`);
		oldWarn(...(args as [defined, ...defined[]]));
	};

	const [success, result] = pcall(() => {
		const [fn, compileError] = loadstring(code);
		if (!fn) error(`Compile error: ${compileError}`);
		return fn();
	});

	env["print"] = oldPrint;
	env["warn"] = oldWarn;

	if (success) {
		return {
			success: true,
			returnValue: result !== undefined ? tostring(result) : undefined,
			output,
			message: "Code executed successfully",
		};
	} else {
		return {
			success: false,
			error: tostring(result),
			output,
			message: "Code execution failed",
		};
	}
}

export = {
	getAttribute,
	setAttribute,
	getAttributes,
	deleteAttribute,
	getTags,
	addTag,
	removeTag,
	getTagged,
	getSelection,
	executeLuau,
};
